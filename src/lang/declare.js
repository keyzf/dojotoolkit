dojo.provide("dojo.lang.declare");

dojo.require("dojo.lang.common");
dojo.require("dojo.lang.extras");

/*
 * Creates a constructor: inherit and extend
 *
 * - inherits from "superclass" (via dojo.inherits, null is ok)
 * - "props" are mixed-in to the prototype (via dojo.lang.extend)
 * - can have an initializer function that fires when the class is created. 
 * - name of the class ("className" argument) is stored in "clasName" property
 * 
 * The initializer function works just like a constructor, except it has the following benefits:
 * - it doesn't fire at inheritance time (when prototyping)
 * - properties set in the initializer do not become part of subclass prototypes
 *
 * The initializer can be specified in the "init" argument, or by including a function called
 * "initializer" in "props".
 *
 * Superclass methods (inherited methods) can be invoked using "inherited" method:
 * this.inherited(<method name>[, <argument array>]);
 * - inherited will continue up the prototype chain until it finds an implementation of method
 * - nested calls to inherited are supported (i.e. inherited method "A" can succesfully call inherited("A"), and so on)
 *
 * Aliased as "dojo.declare"
 *
 * Usage:
 *
 * dojo.declare("my.classes.bar", my.classes.foo, {
 *	initializer: function() {
 *		this.myComplicatedObject = new ReallyComplicatedObject(); 
 *	},
 *	someValue: 2,
 *	aMethod: function() { doStuff(); }
 * });
 *
 */
dojo.lang.declare = function(className /*string*/, superclass /*function*/ , props /*object*/, init /*function*/){
	var ctor = function(){ 
		// get the generational context (which object [or prototype] should be constructed)
		var self = this._getPropContext();
		var s = self.constructor.superclass;
		//dojo.debug('in ' + self.className + ' constructor...');
		if((s)&&(s.constructor)){
			// if this constructor is invoked directly by some constructor (my.ancestor.call(this))
			if(s.constructor==arguments.callee){
				//dojo.debug('calling ancestor constructor');
				this.inherited("constructor", arguments);
			}else{
				//dojo.debug('calling ' + s.className + ' constructor');
				this._inherited(s, "constructor", arguments);
			}
		}
		if((!this.prototyping)&&(self.initializer)){
			//dojo.debug('calling ' + self.className + ' initializer');
			self.initializer.apply(this, arguments);
		}
	}
	if(superclass){
		superclass.prototype.prototyping = true;
		dojo.inherits(ctor, superclass);
		superclass.prototype.prototyping = false; 
	}
	dojo.lang.extend(ctor, dojo.lang.declare.base);
	props=(props||{});
	props.initializer = (props.initializer)||(init)||(function(){ });
	props.className = className;
	dojo.lang.extend(ctor, props);
	dojo.lang.setObjPathValue(className, ctor, null, true);
}
dojo.lang.declare.base = {
	_getPropContext: function() { return (this.___proto||this); },
	// cache ptype context and call method on it
	_inherited: function(ptype, method, args){
		var stack = this.___proto;
		this.___proto = ptype;
		var result = ptype[method].apply(this, args);
		this.___proto = stack;
		return result;
	},
	// searches backward thru prototype chain to find nearest ancestral iplementation of method
	inherited: function(prop, args){
		var p = this._getPropContext();
		do{
			if((!p.constructor)||(!p.constructor.superclass)){return;}
			p = p.constructor.superclass;
		}while(!(prop in p));
		return (typeof p[prop] == 'function' ? this._inherited(p, prop, args) : p[prop]);
	}
}
dojo.declare = dojo.lang.declare;
