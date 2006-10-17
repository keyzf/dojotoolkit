dojo.provide("dojo.lang.declare");

dojo.require("dojo.lang.common");
dojo.require("dojo.lang.extras");

// FIXME: parameter juggling for backward compat ... deprecate and remove after 0.3.*
// new sig: (className (string)[, superclass (function || array)[, init (function)][, props (object)]])
// old sig: (className (string)[, superclass (function || array), props (object), init (function)])
dojo.lang.declare = function(/*String*/ className, /*Function|Array*/ superclass, /*Function?*/ init, /*Object*/ props){
/*
 * summary:
 *	Helper to simulate traditional "constructor" with inheritance using mixins
 *
 * className: the name of the class
 *
 * superclass: may be a Function, or an Array of Functions. 
 *   If "superclass" is an array, the first element is used 
 *   as the prototypical ancestor and any following Functions 
 *   become mixin ancestors.
 *
 * init: an initializer function
 *
 * props: Objects to be mixed in
 *
 * description:
 * Creates a constructor: inherit and extend.  Aliased as "dojo.declare"
 *
 * - inherits from "superclass(es)" 
 * 
 *   All "superclass(es)" must be Functions (not mere Objects).
 *
 *   Using mixin ancestors provides a type of multiple
 *   inheritance. Mixin ancestors prototypical 
 *   properties are copied to the subclass, and any 
 *   inializater/constructor is invoked. 
 *
 * - "props" are copied to the constructor prototype
 *
 * - "className" is stored in the "declaredClass" property
 * 
 * - An initializer function can be specified in the "init" 
 *   argument
 * 
 *
 * Usage:
 *
 * dojo.declare("my.classes.bar", my.classes.foo,
 *	function() {
 *		// initialization function
 *		this.myComplicatedObject = new ReallyComplicatedObject(); 
 *	},
 *	{
 *	someValue: 2,
 *	aMethod: function() { doStuff(); }
 * });
 *
 */
	if((dojo.lang.isFunction(props))||((!props)&&(!dojo.lang.isFunction(init)))){ 
		var temp = props;
		props = init;
		init = temp;
	}	
	var mixins = [ ];
	if(dojo.lang.isArray(superclass)){
		mixins = superclass;
		superclass = mixins.shift();
	}
	if(!init){
		init = dojo.evalObjPath(className, false);
		if(init && !dojo.lang.isFunction(init)){ init = null; }
	}
	var ctor = dojo.lang.declare._makeConstructor();
	var scp = (superclass ? superclass.prototype : null);
	if(scp){
		scp.prototyping = true;
		ctor.prototype = new superclass();
		scp.prototyping = false; 
	}
	ctor.superclass = scp;
	ctor.mixins = mixins;
	for(var i=0,l=mixins.length; i<l; i++){
		dojo.lang.extend(ctor, mixins[i].prototype);
	}
	ctor.prototype.initializer = null;
	ctor.prototype.declaredClass = className;
	if(dojo.lang.isArray(props)){
		dojo.lang.extend.apply(dojo.lang, [ctor].concat(props));
	}else{
		dojo.lang.extend(ctor, props||{});
	}
	dojo.lang.extend(ctor, dojo.lang.declare.base);
	ctor.prototype.constructor = ctor;
	ctor.prototype.initializer = ctor.prototype.initializer || init || (function(){});
	dojo.lang.setObjPathValue(className, ctor, null, true);
	return ctor; // Function
}

dojo.lang.declare._makeConstructor = function(){
	return function(){
		// get the generational context (which object [or prototype] should be constructed)
		var self = this._getPropContext();
		var s = self.constructor.superclass;
		if(s && s.constructor){
			if(s.constructor==arguments.callee){
				// if this constructor is invoked directly (my.ancestor.call(this))
				this._inherited("constructor", arguments);
			}else{
				this._contextMethod(s, "constructor", arguments);
			}
		}
		var m = self.constructor.mixins||[];
		for(var i=0,l=m.length; i<l; i++){
			(((m[i].prototype)&&(m[i].prototype.initializer))||(m[i])).apply(this, arguments);
		}
		if(!this.prototyping && self.initializer){
			self.initializer.apply(this, arguments);
		}
	};
}

dojo.lang.declare.base = {
	_getPropContext: function() { return (this.___proto||this); },
	// caches ptype context and calls method on it
	_contextMethod: function(ptype, method, args){
		var result, stack = this.___proto;
		this.___proto = ptype;
		try { result = ptype[method].apply(this, args||[]); }
		catch(e) { throw e; }	
		finally { this.___proto = stack; }
		return result;
	},
	_inherited: function(prop, args){
		// summary
		//	Searches backward thru prototype chain to find nearest ancestral instance of prop.
		//	Internal use only.
		var p = this._getPropContext();
		do{
			if((!p.constructor)||(!p.constructor.superclass)){return;}
			p = p.constructor.superclass;
		}while(!(prop in p));
		return (dojo.lang.isFunction(p[prop]) ? this._contextMethod(p, prop, args) : p[prop]);
	}
}

dojo.declare = dojo.lang.declare;