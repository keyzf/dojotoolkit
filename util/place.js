dojo.provide("dijit.util.place");

// ported from dojo.html.util

dijit.util.getViewport = function(){
	//	summary
	//	Returns the dimensions of the viewable area of a browser window
	var _window = dojo.global;
	var _document = dojo.doc;
	var w = 0;
	var h = 0;

	if(dojo.isMozilla){
		// mozilla
		w = _document.documentElement.clientWidth;
		h = _window.innerHeight;
	}else if(!dojo.isOpera && _window.innerWidth){
		//in opera9, dojo.body().clientWidth should be used, instead
		//of window.innerWidth/document.documentElement.clientWidth
		//so we have to check whether it is opera
		w = _window.innerWidth;
		h = _window.innerHeight;
	}else if(dojo.isIE && _document.documentElement && _document.documentElement.clientHeight){
		w = _document.documentElement.clientWidth;
		h = _document.documentElement.clientHeight;
	}else if(dojo.body().clientWidth){
		// IE5, Opera
		w = dojo.body().clientWidth;
		h = dojo.body().clientHeight;
	}
	return { w: w, h: h };	//	object
};

dijit.util.getScroll = function(){
	//	summary: returns the scroll position of the document
	var _window = dojo.global;
	if( typeof _window.pageYOffset != "undefined" ){
		return { x: _window.pageXOffset, y: _window.pageYOffset };
	}else{
		var _doc = dojo.doc.documentElement;
		return { x: _doc.scrollLeft, y: _doc.scrollTop };
	}
};

dijit.util.placeOnScreen = function(
	/* HTMLElement */	node,
	/* Object */		desiredPos,
	/* Object */		corners,
	/* boolean? */		tryOnly){
	//	summary:
	//		Keeps 'node' in the visible area of the screen while trying to
	//		place closest to desiredPos.x, desiredPos.y. The input coordinates are
	//		expected to be the desired document position.
	//
	//		Set which corner(s) you want to bind to, such as
	//		
	//			placeOnScreen(node, {x: 10, y: 20}, ["TR", "BL"])
	//		
	//		The desired x/y will be treated as the topleft(TL)/topright(TR) or
	//		BottomLeft(BL)/BottomRight(BR) corner of the node. Each corner is tested
	//		and if a perfect match is found, it will be used. Otherwise, it goes through
	//		all of the specified corners, and choose the most appropriate one.
	//
	//		If tryOnly is set to true, the node will not be moved to the place.
	//		
	//		NOTE: node is assumed to be absolutely or relatively positioned.

	var scroll = dijit.util.getScroll();
	var view = dijit.util.getViewport();

	node = dojo.byId(node);
	var oldDisplay = node.style.display;
	var oldVis = node.style.visibility;
	node.style.visibility = "hidden";
	node.style.display = "";
//	var bb = dojo.html.getBorderBox(node);
	var bb = dojo.marginBox(node); //PORT okay?
	var w = bb.w;
	var h = bb.h;
	node.style.display = oldDisplay;
	node.style.visibility = oldVis;

	//#2670
	var visiblew,visibleh,bestw,besth="";

	var bestx, besty, bestDistance = Infinity, bestCorner;

	for(var cidex=0; cidex<corners.length; ++cidex){
		var visiblew,visibleh="";
		var corner = corners[cidex];
		var match = true;

		// guess where to put the upper left corner of the popup, based on which corner was passed
		// if you choose a corner other than the upper left,
		// obviously you have to move the popup
		// so that the selected corner is at the x,y you asked for
		var tryX = desiredPos.x - (corner.charAt(1)=='L' ? 0 : w) - scroll.x;
		var tryY = desiredPos.y - (corner.charAt(0)=='T' ? 0 : h) - scroll.y;

		// x component
		// test if the popup does not fit
		var x = tryX + w;
		if(x > view.w){
			match = false;
		}
		// viewport => document
		// min: left side of screen
		x = tryX + scroll.x;
		// calculate the optimal width of the popup
		if(corner.charAt(1)=='L'){
			if(w>view.w-tryX){
				visiblew=view.w-tryX;
				match=false;
			}else{
				visiblew=w;
			}
		}else{
			if(tryX<0){
				visiblew=w+tryX;
				match=false;
			}else{
				visiblew=w;
			}
		}
		// y component
		// test if the popup does not fit
		var y = tryY + h;
		if(y > view.h){
			match = false;
		}
		// viewport => document
		// min: top side of screen
		y = tryY + scroll.y;
		// calculate the optimal height of the popup
		if(corner.charAt(0)=='T'){
			if(h>view.h-tryY){
				visibleh=view.h-tryY;
				match=false;
			}else{
				visibleh=h;
			}
		}else{
			if(tryY<0){
				visibleh=h+tryY;
				match=false;
			}else{
				visibleh=h;
			}
		}

		if(match){ //perfect match, return now
			bestx = x;
			besty = y;
			bestDistance = 0;
			bestw = visiblew;
			besth = visibleh;
			bestCorner = corner;
			break;
		}else{
			//not perfect, find out whether it is better than the saved one
			// weight this position by its squared distance
			var dist = Math.pow(x-tryX-scroll.x,2)+Math.pow(y-tryY-scroll.y,2);
			// if there was not a perfect match but dist=0 anyway (popup too small) weight by size of popup
			if(dist==0){dist=Math.pow(h-visibleh,2);}
			// choose the lightest (closest or biggest popup) position
			if(bestDistance > dist){
				bestDistance = dist;
				bestx = x;
				besty = y;
				bestw = visiblew;
				besth = visibleh;
				bestCorner = corner;
			}
		}
	}

	if(!tryOnly){
		node.style.left = bestx + "px";
		node.style.top = besty + "px";
	}

	return {left: bestx, top: besty, x: bestx, y: besty, dist: bestDistance, corner:  bestCorner, h:besth, w:bestw};	//	object
}

dijit.util.placeOnScreenAroundElement = function(
	/* HTMLElement */	node,
	/* HTMLElement */	aroundNode,
	/* Object */		aroundCorners){

	//	summary
	//	Like placeOnScreen, except it accepts aroundNode instead of x,y
	//	and attempts to place node around it.  Uses margin box dimensions.
	//
	//	aroundCorners
	//		specify Which corner of aroundNode should be
	//		used to place the node => which corner(s) of node to use (see the
	//		corners parameter in dijit.util.placeOnScreen)
	//		e.g. {'TL': 'BL', 'BL': 'TL'}

	// This won't work if the node is inside a <div style="position: relative">,
	// so reattach it to document.body.   (Otherwise, the positioning will be wrong
	// and also it might get cutoff)
	if(!node.parentNode || String(node.parentNode.tagName).toLowerCase() != "body"){
		dojo.body().appendChild(node);
	}

	var best, bestDistance=Infinity;
	aroundNode = dojo.byId(aroundNode);
	var oldDisplay = aroundNode.style.display;
	aroundNode.style.display="";
	// #3172: use the slightly tighter border box instead of marginBox
	//var mb = dojo.marginBox(aroundNode);
	//aroundNode.style.borderWidth="10px";
	var aroundNodeW = aroundNode.offsetWidth; //mb.w;
	var aroundNodeH = aroundNode.offsetHeight; //mb.h;
	var aroundNodePos = dojo.coords(aroundNode, true);
	aroundNode.style.display=oldDisplay;

	for(var nodeCorner in aroundCorners){
		var corners = aroundCorners[nodeCorner];

		var desiredPos = {
			x: aroundNodePos.x + (nodeCorner.charAt(1)=='L' ? 0 : aroundNodeW),
			y: aroundNodePos.y + (nodeCorner.charAt(0)=='T' ? 0 : aroundNodeH)
		};

		var pos = dijit.util.placeOnScreen(node, desiredPos, [corners], true);
		if(pos.dist == 0){
			best = pos;
			break;
		}else{
			//not perfect, find out whether it is better than the saved one
			if(bestDistance > pos.dist){
				bestDistance = pos.dist;
				best = pos;
			}
		}
	}

	node.style.left = best.left + "px";
	node.style.top = best.top + "px";

	return best;	//	object
}
