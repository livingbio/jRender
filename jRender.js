(function(window) {

    var init_data = {};

	var jRender = function(json, options, data) {
        init_data = data;
		return new jRender.fn.init(json, options);
	};
	
	var _in_process = {};

	jRender.ARRAY = "array";
	jRender.OBJECT = "object";
	jRender.INPUT = "input";


    
    var name_encode = function(name){
        return encodeURIComponent(name);
    };

    var name_decode = function(name){
        return decodeURIComponent(name);
    };

    var reverse_name_scop = function(name){
        var scops = name && name.split('&') || [];
        var tmp = [];
        for(var i=0; i<scops.length;i++) {
            tmp.push(name_decode(scops[i]));
        }
        return tmp
    }

    var fetch_default = function(target, data){
        target = reverse_name_scop(target);
        tmp = data || {};
        for(var i=0;i<target.length;i++){
            var scop = target[i];
            tmp = tmp[scop];
            if(!tmp){
                break;
            }
        }
        return tmp;
    }


	jRender.fn = jRender.prototype = {
		init : function(json, options) {
            
			if ( typeof (json) === "undefined")
				json = {};

			this.schema = json;
			this.root_type = json.type || this.getFormType(json);
			this.root = options.root || json.title;
			if (!this.root){
				throw new Error("Please provide a root form title");
			}
			
			this.form_sections = {};
			this.render_options = options["render-options"] || {};
			
            var tmp = {}
            tmp[this.root] = init_data
            init_data = tmp;
			//if the root form is an array and no forms have been created;
            this.root = name_encode(this.root);
			var main_form = this.parse(this.root, this.schema);
			if (!this.form_sections[this.root]){
				this.form_sections[this.root] = new FormSection(this.root);
				this.form_sections[this.root].fields.push(main_form);
			}
			
			this.draw(this.root, options.hook);

			var form = new Form(this.root, options.method, options.action);
			$(options.hook).wrap(form.html);
		},
		
		draw : function(root, hook){
			var fields = this.form_sections[root].fields;
			var form_section_div = this.form_sections[root].html;
            root = root.split('&')
            root.reverse()
			var title = jQuery("<h4>").html(name_decode(root[0]));
			form_section_div.append(title);
			for (var i=0; i<fields.length; i++){
				var field_div = jQuery("<div>");
				if (fields[i] instanceof FormSection){
					this.draw(fields[i].name, field_div);
				} else {
					field_div.append(fields[i].html);
				}
				form_section_div.append(field_div);
			}
			
			$(hook).append(form_section_div);
		},

		getRefSchema : function(ref_path_parts) {
			var ref_schema = null;

			//assuming that index 0 is going to be # everytime
			ref_schema = this.schema;
			for (var i = 1; i < ref_path_parts.length; i++) {
				ref_schema = ref_schema[ref_path_parts[i]];
			}
			return ref_schema;
		},

		getFormType : function(_fragment) {
			var type;
			
			if (_fragment.type || _fragment.enum)
				return _fragment.type || "enum";

			if (_fragment.items) {
				type = jRender.ARRAY;
			} else if (_fragment.properties) {
				type = jRender.OBJECT;
			} else if (_fragment.$ref) {
				var ref_path_parts = _fragment.$ref.split("/");
				_fragment = this.getRefSchema(ref_path_parts);
				type = this.getFormType(_fragment);
			}

			if (!type || (type).trim() == "") {
				throw new Error("Cannot determine type of form");
			}

			return type;
		},
		
		_createButtonToHandleRef : function(root, _fragment, type){
			var button_for_render = new Button(_fragment.title || root);
			var me = this;
			var _buttonClickHandler = function(e){
				e.preventDefault();
				me.form_sections[root] = new FormSection(root);
				me.form_sections[root].fields.push(me.parse(root, _fragment));
				me.draw(root, this.parentNode);
				if (type == jRender.OBJECT){
					this.parentNode.children[0].remove();
				}
			};
			button_for_render.addEventHandler("click", _buttonClickHandler);
			return button_for_render;
		},
		
		validate : function(type, _fragment){
			if (type == jRender.ARRAY && !_fragment.items){
				throw new Error("Please check schema. Array has no items");
			}
			
			if (type == jRender.OBJECT && !_fragment.properties){
				throw new Error("Please check schema. Object has no properties");
			}
			
			if (type != this.getFormType(_fragment)){
				throw new Error("Type mismatch");
			}
		},

		parse : function(root, _fragment, scop) {
			var type = this.getFormType(_fragment);
			var _is_ref = false;
			
			var $ref = _fragment.$ref || (_fragment.items && _fragment.items.$ref) || null;
			var _fragment_from_ref;
			var next_root;
			
			if($ref){
				var ref_path_parts = $ref.split("/");
				_fragment_from_ref = this.getRefSchema(ref_path_parts);
			}
			
			if (type == jRender.ARRAY){
				
				this.validate(type, _fragment);
				return this._createButtonToHandleRef(root, _fragment_from_ref || _fragment.items, type);
				
			} else if (type == jRender.OBJECT){
				if (!_in_process[root]){
					_in_process[root] = true;
					if($ref){
						_fragment = _fragment_from_ref;
						this.parse(root, _fragment);
					}
					this.validate(type, _fragment);
					this.form_sections[root] = new FormSection(root);
					for (prop in _fragment.properties){
						next_root = root+"&"+name_encode(prop);
						this.form_sections[root].fields.push(this.parse(next_root, _fragment.properties[prop]));
					}
					_in_process[root] = false;
					return this.form_sections[root];
				} else {
					return  this._createButtonToHandleRef(root, _fragment, type);
				}
				
			} else {
				var render_options = this.render_options["render-types"];
				var render_type = (render_options && render_options[type]) || null;
				var options;
                options = _fragment
				return new Field(root, render_type || type , options );
			}
		}
	}
	
	var DOMElement = function(){
		
	};
	
	DOMElement.prototype = {
		setHTML : function(){
			
		}
	};

	var Button = function(button_text) {
		this.name = button_text;
		this.setHTML();
	};
	
	Button.prototype = new DOMElement;
	
	Button.prototype.setHTML = function(){
		var html = jQuery("<button>");
		html.html(this.name);
		this.html = html;
	}
	
	Button.prototype.addEventHandler = function(event, handler){
		this.html.on(event, handler);
	}

	var FormSection = function(name) {
		this.name = name;
		this.fields = [];
		this.setHTML();
	};
	
	FormSection.prototype = new DOMElement;
	
	FormSection.prototype.setHTML = function(){
		var html = jQuery("<div>");
		html.attr("name", this.name)
		html.addClass("indent");
		this.html = html;
	}

	var Field = function(name, type, options) {
		this.name = name;
		this.type = type;
		this.options = options || {}
        var tmp = name.split('&')
        tmp.reverse()
        this.title = this.options.title || name_decode(tmp[0]);
        this.default = fetch_default(name, init_data) || this.options.default;
		this.setHTML();
	};
	
	Field.prototype = new DOMElement;
	
	Field.prototype.setHTML = function(){
		var html;
		if (this.type == "select") {
			var header = jQuery("<h4>").html(this.name);
			html = jQuery("<select>");
			var o = new Option("Please Choose", "");
			$(o).html("Please Choose");
			html.append(o);
            var option_datas = this.options.enum;
			for (var i=0; i<option_datas.length; i++){
                var value = option_datas[i]
				o = new Option(value, value);
                if(value == this.default){
                    o.setAttribute('selected', 'selected');
                };
				$(o).html(value);
				html.append(o);
			}
			html = jQuery("<div>").append(html);
			html.prepend(header);
			this.html = html;
		} else if (this.type=="radio" || this.type=="checkbox"){
			var header = jQuery("<h4>").html(this.title);
			html = jQuery("<div>");
			html.append(header);
			var o;
            var option_datas = this.options.enum;
			for (var i=0; i<option_datas.length; i++){
                var value = option_datas[i];
				o = "<input type='"+this.type+"' name='"+this.name+"' value='"+ value;
                if(jQuery.inArray(value, this.default) != -1){
                    o+= " checked ";
                }

                o +="'>"+value + "<br>";


				html.append(o);
			}
			this.html = html;
		} 
		else if (this.type=="number"){
			html = jQuery("<input type='number'>").attr("placeholder", this.title);
            html.attr("name", this.name)
            html.attr("value", this.default)
			this.html = html;
		}
		else {
			html = jQuery("<input>").attr("placeholder", this.title);
            html.attr("name", this.name)
            html.attr("value", this.default)
			this.html = html;
		}
	}
	
	var Form = function(name, method, action) {
		this.name = name;
		this.method = method;
		this.action = action;
		this.setHTML();
	}
	
	Form.prototype = new DOMElement;
	
	Form.prototype.setHTML = function(){
		var html = jQuery("<form>").attr("method", this.method).attr("action", this.action).attr("name", this.name);
		this.html = html;
	}

	jRender.UTILS = {
		"FormSection" : FormSection,
		"Button" : Button,
		"Field" : Field
	};

	jRender.fn.init.prototype = jRender.prototype;

	window.jRender = jRender;

})(window);
