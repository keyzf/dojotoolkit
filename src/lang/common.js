dojo.provide("dojo.lang.common");

dojo.require("dojo.lang");

/*
 * Adds the given properties/methods to the specified object
 */
dojo.lang.mixin = function(obj, props){
	var tobj = {};
	for(var x in props){
		// the "tobj" condition avoid copying properties in "props"
		// inherited from Object.prototype.  For example, if obj has a custom
		// toString() method, don't overwrite it with the toString() method
		// that props inherited from Object.protoype
		if(typeof tobj[x] == "undefined" || tobj[x] != props[x]) {
			obj[x] = props[x];
		}
	}
	// IE doesn't recognize custom toStrings in for..in
	if(dojo.render.html.ie && dojo.lang.isFunction(props["toString"]) && props["toString"] != obj["toString"]) {
		obj.toString = props.toString;
	}
	return obj;
}

/*
 * Adds the given properties/methods to the specified object's prototype
 */
dojo.lang.extend = function(ctor, props){
	this.mixin(ctor.prototype, props);
}

/**
 * Set a value on a reference specified as a string descriptor. 
 * (e.g. "A.B") in the given context.
 * 
 * setObjPathValue(String objpath, value [, Object context, Boolean create])
 *
 * If context is not specified, dj_global is used
 * If create is true, undefined objects in the path are created.
 */
dojo.lang.setObjPathValue = function(objpath, value, context, create){
	if(arguments.length < 4){
		create = true;
	}
	with(dojo.parseObjPath(objpath, context, create)){
		if(obj && (create || (prop in obj))){
			obj[prop] = value;
		}
	}
}

/*
 * Creates a class
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
 * An optional inherits-time construtor can be specified or by including a function called
 * "classConstructor" in "props".
 *
 * Superclass methods (inherited methods) can be invoked using "inherited" method:
 * this.inherited(<method name>[, <argument array>]);
 * - inherited will continue up the prototype chain until it finds an implementation of method
 * - nested calls to inherited are supported (i.e. inherited method "A" can succesfully call inherited("A"), and so on)
 *
 * Aliased as "dojo.defineClass"
 *
 * Usage:
 *
 * dojo.defineClass("my.classes.bar", my.classes.foo, {
 *	classConstructor: function() {
 *		this.myComplicatedObject = new ReallyComplicatedObject(); 
 *	},
 *	someValue: 2,
 *	someOtherValue: "abc",
 *	aMethod: function() { doStuff(); }
 * });
 *
 */
dojo.lang.defineClass = function(className /*string*/, superclass /*function*/ , props /*object*/, init /*function*/){
	var ctor = function(){ 
		var c = this.constructor;
		var s = c.superclass;
		if(s){
			s.prototyping = this.prototyping;
			s.constructor.apply(s, arguments); // using superclass context is the tricky bit
		}
		if((!this.prototyping)&&(c.prototype.initializer)){
			c.prototype.initializer.apply(this, arguments);
		}
		this.prototyping = false;
	}
	ctor.prototype.inherited=function(method, args){
		// searches backward thru prototype chain to find nearest ancestral iplementation of method
		// this could be shorter by half if we remove idiot proofing and ancestor skipping
		var p = (this._proto || this);
		do{
			if((!p.constructor)||(!p.constructor.superclass)){return;}
			p = p.constructor.superclass;
		}while(!(method in p));
		var stack = this._proto;
		this._proto = p;
		var result = p[method].apply(this, args);
		this._proto = stack;
		return result;
	}
	if(superclass){
		superclass.prototype.prototyping = true;
		dojo.inherits(ctor, superclass);
		superclass.prototype.prototyping = false; // needed if superclass was not generated from defineClass
	}
	props=(props||{});
	props.className = className;
	props.initializer = (props.initializer)||(init)||null;
	dojo.lang.extend(ctor, props);
	dojo.lang.setObjPathValue(className, ctor, null, true);
};
dojo.defineClass = dojo.lang.defineClass;

/**
 * See if val is in arr. Call signatures:
 *  find(array, value, identity) // recommended
 *  find(value, array, identity)
**/
dojo.lang.find = function(	/*Array*/	arr, 
							/*Object*/	val,
							/*boolean*/	identity,
							/*boolean*/	findLast){
	// support both (arr, val) and (val, arr)
	if(!dojo.lang.isArrayLike(arr) && dojo.lang.isArrayLike(val)) {
		var a = arr;
		arr = val;
		val = a;
	}
	var isString = dojo.lang.isString(arr);
	if(isString) { arr = arr.split(""); }

	if(findLast) {
		var step = -1;
		var i = arr.length - 1;
		var end = -1;
	} else {
		var step = 1;
		var i = 0;
		var end = arr.length;
	}
	if(identity){
		while(i != end) {
			if(arr[i] === val){ return i; }
			i += step;
		}
	}else{
		while(i != end) {
			if(arr[i] == val){ return i; }
			i += step;
		}
	}
	return -1;
}

dojo.lang.indexOf = dojo.lang.find;

dojo.lang.findLast = function(/*Array*/ arr, /*Object*/ val, /*boolean*/ identity){
	return dojo.lang.find(arr, val, identity, true);
}

dojo.lang.lastIndexOf = dojo.lang.findLast;

dojo.lang.inArray = function(arr /*Array*/, val /*Object*/){
	return dojo.lang.find(arr, val) > -1; // return: boolean
}

/**
 * Partial implmentation of is* functions from
 * http://www.crockford.com/javascript/recommend.html
 * NOTE: some of these may not be the best thing to use in all situations
 * as they aren't part of core JS and therefore can't work in every case.
 * See WARNING messages inline for tips.
 *
 * The following is* functions are fairly "safe"
 */

dojo.lang.isObject = function(wh) {
	return typeof wh == "object" || dojo.lang.isArray(wh) || dojo.lang.isFunction(wh);
}

dojo.lang.isArray = function(wh) {
	return (wh instanceof Array || typeof wh == "array");
}

dojo.lang.isArrayLike = function(wh) {
	if(dojo.lang.isString(wh)){ return false; }
	if(dojo.lang.isFunction(wh)){ return false; } // keeps out built-in ctors (Number, String, ...) which have length properties
	if(dojo.lang.isArray(wh)){ return true; }
	if(typeof wh != "undefined" && wh
		&& dojo.lang.isNumber(wh.length) && isFinite(wh.length)){ return true; }
	return false;
}

dojo.lang.isFunction = function(wh) {
	return (wh instanceof Function || typeof wh == "function");
}

dojo.lang.isString = function(wh) {
	return (wh instanceof String || typeof wh == "string");
}

dojo.lang.isAlien = function(wh) {
	return !dojo.lang.isFunction() && /\{\s*\[native code\]\s*\}/.test(String(wh));
}

dojo.lang.isBoolean = function(wh) {
	return (wh instanceof Boolean || typeof wh == "boolean");
}

/**
 * The following is***() functions are somewhat "unsafe". Fortunately,
 * there are workarounds the the language provides and are mentioned
 * in the WARNING messages.
 *
 * WARNING: In most cases, isNaN(wh) is sufficient to determine whether or not
 * something is a number or can be used as such. For example, a number or string
 * can be used interchangably when accessing array items (arr["1"] is the same as
 * arr[1]) and isNaN will return false for both values ("1" and 1). Should you
 * use isNumber("1"), that will return false, which is generally not too useful.
 * Also, isNumber(NaN) returns true, again, this isn't generally useful, but there
 * are corner cases (like when you want to make sure that two things are really
 * the same type of thing). That is really where isNumber "shines".
 *
 * RECOMMENDATION: Use isNaN(wh) when possible
 */
dojo.lang.isNumber = function(wh) {
	return (wh instanceof Number || typeof wh == "number");
}

/**
 * WARNING: In some cases, isUndefined will not behave as you
 * might expect. If you do isUndefined(foo) and there is no earlier
 * reference to foo, an error will be thrown before isUndefined is
 * called. It behaves correctly if you scope yor object first, i.e.
 * isUndefined(foo.bar) where foo is an object and bar isn't a
 * property of the object.
 *
 * RECOMMENDATION: Use `typeof foo == "undefined"` when possible
 *
 * FIXME: Should isUndefined go away since it is error prone?
 */
dojo.lang.isUndefined = function(wh) {
	return ((wh == undefined)&&(typeof wh == "undefined"));
}

// end Crockford functions
