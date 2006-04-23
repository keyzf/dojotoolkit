/**
 * Layout a bunch of child dom nodes within a parent dom node
 * Input is an array of objects like:
 * @ container - parent node
 * @ layoutPriority - "top-bottom" or "left-right"
 * @ children an array like [ {domNode: foo, layoutAlign: "bottom" }, {domNode: bar, layoutAlign: "client"} ]
 */
 
dojo.provide("dojo.layout");

dojo.require("dojo.lang");
dojo.require("dojo.style");

dojo.layout = function(container, children, layoutPriority) {
	// container must be either relative or absolute position so that we
	// can position nodes inside of it
	var position=dojo.style.getStyle(container, "position");
	if(position != "absolute" && position != "relative"){
		dojo.style.setStyle(container, "position", "relative");
	}

	// copy children array and remove elements w/out layout
	children = dojo.lang.filter(children, function(child){
		return dojo.lang.inArray(["top","bottom","left","right","client","flood"], child.layoutAlign)
	});

	// order the children according to layoutPriority
	if(layoutPriority && layoutPriority!="none"){
		var rank = function(child){
			switch(child.layoutAlign){
				case "flood":
					return 1;
				case "left":
				case "right":
					return (layoutPriority=="left-right") ? 2 : 3;
				case "top":
				case "bottom":
					return (layoutPriority=="left-right") ? 3 : 2;
				default:
					return 4;
			}
		};
		children.sort(function(a,b){ return rank(a)-rank(b); });
	}

	// remaining space (blank area where nothing has been written)
	var f={
		top: dojo.style.getPixelValue(container, "padding-top", true),
		left: dojo.style.getPixelValue(container, "padding-left", true),
		height: dojo.style.getContentHeight(container),
		width: dojo.style.getContentWidth(container)
	};

	// set positions/sizes
	dojo.lang.forEach(children, function(child){
		var elm=child.domNode;
		var pos=child.layoutAlign;

		// set elem to upper left corner of unused space; may move it later
		with(elm.style){
			position = "absolute";
			left = f.left+"px";
			top = f.top+"px";
			if(pos=="client"||pos=="flood"){
				overflow = "auto";
			}
		}

		// set size && adjust record of remaining space.
		// note that setting the width of a <div> may affect it's height.
		// TODO: same is true for widgets but need to implement API to support that
		if ( (pos=="top")||(pos=="bottom") ) {
			dojo.style.setOuterWidth(elm, f.width);
			var h = dojo.style.getOuterHeight(elm);
			f.height -= h;
			if(pos=="top"){
				f.top += h;
			}else{
				elm.style.top = f.top + f.height + "px";
			}
		}else if(pos=="left" || pos=="right"){
			dojo.style.setOuterHeight(elm, f.height);
			var w = dojo.style.getOuterWidth(elm);
			f.width -= w;
			if(pos=="left"){
				f.left += w;
			}else{
				elm.style.left = f.left + f.width + "px";
			}
		} else if(pos=="flood" || pos=="client"){
			dojo.style.setOuterWidth(elm, f.width);
			dojo.style.setOuterHeight(elm, f.height);
		}
		
		// TODO: for widgets I want to call resizeTo(), but for top/bottom
		// alignment I only want to set the width, and have the size determined
		// dynamically.  (The thinner you make a div, the more height it consumes.)
		if(child.onResized){
			child.onResized();
		}
	});
};