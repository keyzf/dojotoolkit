dojo.provide("dojox.layout.BorderContainer");

dojo.require("dijit.layout._LayoutWidget");

dojo.experimental("dojox.layout.BorderContainer");

dojo.declare(
	"dojox.layout.BorderContainer",
//	[dijit._Widget, dijit._Container, dijit._Contained],
	dijit.layout._LayoutWidget,
{
	// summary
	//	Provides layout in 5 regions, a center and borders along its 4 sides.
	//
	// details
	//	A BorderContainer is a box with a specified size (like style="width: 500px; height: 500px;"),
	//	that contains children widgets marked with "position" of "top", "bottom", "leading", "trailing", "center".
	//  Children will be laid out inside the edges of the box with the remaining space left for the center.
	//  Optional splitters may be specified on the edge widgets to make them resizable by the user.
	//  The outer size must be specified on the BorderContainer node.  Width must be specified for the sides
	//  and height for the top and bottom.
	//  "left" and "right" may be used interchangably for "leading" and "trailing" except that those terms do
	//  not reflect the fact that they will be reversed in right-to-left environments.
	//
	// usage
	//	<style>
	//		html, body{ height: 100%; width: 100%; }
	//	</style>
	//	<div dojoType="BorderContainer" design="sidebar" style="width: 100%; height: 100%">
	//		<div dojoType="ContentPane" region="top">header text</div>
	//		<div dojoType="ContentPane" region="right" style="width: 200px;">table of contents</div>
	//		<div dojoType="ContentPane" region="center">client area</div>
	//	</div>

	// design: String
	//  choose which design is used for the layout: "headline" (default) where the top and bottom extend
	//  the full width of the container, or "sidebar" where the left and right sides extend from top to bottom.
	design: "headline",

	liveSplitters: true,

//TODO: persist for splitters?

	postCreate: function(){
		this.inherited("postCreate", arguments);

		this.domNode.style.position = "relative";
		dojo.addClass(this.domNode, "dijitBorderContainer");
	},

	startup: function(){
		if(this._started){ return; }

		this._splitters = {};
		if(this.getChildren){
			dojo.forEach(this.getChildren(), this._setupChild, this);
		}

		this.inherited("startup", arguments);
	},

	_setupChild: function(/*Widget*/child){
		var region = child.region;
		if(region){
			child.domNode.style.position = "absolute";

			if(region == "leading"){ region = "left"; }
			if(region == "trailing"){ region = "right"; }
			if(!dojo._isBodyLtr()){
				if(region == "left"){
					region = "right";
				}else if(region == "right"){
					region = "left";
				}
			}
			this["_"+region] = child.domNode;

			if(child.splitter){
				var opp = ({left:'right', right:'left', leading:'trailing', trailing:'leading', top:'bottom', bottom:'top'})[child.region];
				var oppNode = dojo.query('[region='+opp+']', this.domNode)[0];
				var splitter = new dojox.layout._Splitter({ container: this, child: child, region: region, oppNode: oppNode, live: this.liveSplitters });
				this._splitters[region] = splitter.domNode;
				dojo.place(splitter.domNode, child.domNode, "after");
			}
		}
	},

	layout: function(){
		this._layoutChildren(this.domNode, this._contentBox, this.getChildren());
	},

	addChild: function(/*Widget*/ child, /*Integer?*/ insertIndex){
		dijit._Container.prototype.addChild.apply(this, arguments);
		this._setupChild(child);
		if(this._started){
			this._layoutChildren(this.domNode, this._contentBox, this.getChildren());
		}
	},

	removeChild: function(/*Widget*/ child){
		var region = child.region;
		var splitter = this._splitters[region];
		if(splitter){
			dijit.byNode(splitter).destroy();
			delete this._splitters[region];
		}
		dijit._Container.prototype.removeChild.apply(this, arguments);
		delete this["_"+region];
		if(this._started){
			this._layoutChildren(this.domNode, this._contentBox, this.getChildren());
		}
	},

	_layoutChildren: function(/*DomNode*/ container, /*Object*/ dim, /*Object[]*/ children){
		/**
		 * summary
		 *		Layout a bunch of child dom nodes within a parent dom node
		 * container:
		 *		parent node
		 * dim:
		 *		{l, t, w, h} object specifying dimensions of container into which to place children
		 * children:
		 *		an array like [ {domNode: foo, region: "bottom" }, {domNode: bar, region: "client"} ]
		 */

//TODO: what is dim and why doesn't it look right?
		// copy dim because we are going to modify it
//		dim = dojo.mixin({}, dim);

//TODO: need to test in quirks vs std mode in IE

		var sidebarLayout = (this.design == "sidebar");
		var topHeight = 0, bottomHeight = 0, leftWidth = 0, rightWidth = 0;
		var topStyle = {}, leftStyle = {}, rightStyle = {}, bottomStyle = {},
			centerStyle = (this._center && this._center.style) || {};

		if(this._top){
			topStyle = this._top.style;
			topHeight = dojo.marginBox(this._top).h;
		}
		if(this._left){
			leftStyle = this._left.style;
			leftWidth = dojo.marginBox(this._left).w;
		}
		if(this._right){
			rightStyle = this._right.style;
			rightWidth = dojo.marginBox(this._right).w;
		}
		if(this._bottom){
			bottomStyle = this._bottom.style;
			bottomHeight = dojo.marginBox(this._bottom).h;
		}

		var splitterBounds = {
			left: (sidebarLayout ? leftWidth : "0") + "px",
			right: (sidebarLayout ? rightWidth : "0") + "px"
		};

		var topSplitter = this._splitters.top;
		if(topSplitter){
			dojo.mixin(topSplitter.style, splitterBounds);
			topSplitter.style.top = topHeight + "px";
		}

		var bottomSplitter = this._splitters.bottom;
		if(bottomSplitter){
			dojo.mixin(bottomSplitter.style, splitterBounds);
			bottomSplitter.style.bottom = bottomHeight + "px";
		}

		splitterBounds = {
			top: (sidebarLayout ? "0" : topHeight) + "px",
			bottom: (sidebarLayout ? "0" : bottomHeight) + "px"
		};

		var leftSplitter = this._splitters.left;
		if(leftSplitter){
			dojo.mixin(leftSplitter.style, splitterBounds);
			leftSplitter.style.left = leftWidth + "px";
		}

		var rightSplitter = this._splitters.right;
		if(rightSplitter){
			dojo.mixin(rightSplitter.style, splitterBounds);
			rightSplitter.style.right = rightWidth + "px";
console.log("RIGHT SPLITTER="+rightWidth);
		}

		var topSplitterSize = topSplitter ? dojo.marginBox(topSplitter).h : 0;
		var leftSplitterSize = leftSplitter ? dojo.marginBox(leftSplitter).w : 0;
		var rightSplitterSize = rightSplitter ? dojo.marginBox(rightSplitter).w : 0;
		var bottomSplitterSize = bottomSplitter ? dojo.marginBox(bottomSplitter).h : 0;

		dojo.mixin(centerStyle, {
			top: topHeight + topSplitterSize + "px",
			left: leftWidth + leftSplitterSize + "px",
			right:  rightWidth + rightSplitterSize + "px",
			bottom: bottomHeight + bottomSplitterSize + "px"
		});

		var bounds = {
			top: sidebarLayout ? "0px" : centerStyle.top,
			bottom: sidebarLayout ? "0px" : centerStyle.bottom
		};
		dojo.mixin(leftStyle, bounds);
		dojo.mixin(rightStyle, bounds);
		leftStyle.left = rightStyle.right = "0px";

		topStyle.top = bottomStyle.bottom = "0px";
		if(sidebarLayout){
			topStyle.left = bottomStyle.left = leftWidth + (dojo._isBodyLtr() ? 0 : leftSplitterSize) + "px";
			topStyle.right = bottomStyle.right = rightWidth + (dojo._isBodyLtr() ? rightSplitterSize : 0) + "px";
		}else{
			topStyle.left = topStyle.right = "0px";
			bottomStyle.left = bottomStyle.right = "0px";
		}

		if(dojo.isIE){
			//FIXME: hack.  use IDs instead
			this.domNode._top = this._top;
			this.domNode._bottom = this._bottom;

			var containerHeight = "dojo.style("+this.id+",'height')";
			var middleHeight = containerHeight;
			if(this._top){ middleHeight += "-dojo.style("+this.id+"._top,'height')"; }
			if(this._bottom){ middleHeight += "-dojo.style("+this.id+"._bottom, 'height')"; }
			if(this._center){ centerStyle.setExpression("height", middleHeight); }
//TODO: What I'd think would work
//			leftStyle.setExpression("height", sidebarLayout ? containerHeight : middleHeight);
//			rightStyle.setExpression("height", sidebarLayout ? containerHeight : middleHeight);
//What actually works
			if(this._left){ leftStyle.setExpression("height", sidebarLayout ? this.id+".offsetHeight" : middleHeight + "+" + this.id+".offsetHeight-"+containerHeight); }
			if(this._right){ rightStyle.setExpression("height", sidebarLayout ? this.id+".offsetHeight" : middleHeight + "+" + this.id+".offsetHeight-"+containerHeight); }

			if(dojo.isIE < 7){
				//FIXME: hack.  use IDs instead
				this.domNode._left = this._left;
				this.domNode._right = this._right;

				var containerWidth = "dojo.style("+this.id+",'width')";
				var middleWidth = containerWidth;
				if(this._left){ middleWidth += "-dojo.style("+this.id+"._left,'width')"; }
				if(this._right){ middleWidth += "-dojo.style("+this.id+"._right, 'width')"; }
				if(this._center){ centerStyle.setExpression("width", middleWidth); }
				if(this._top){ topStyle.setExpression("width", sidebarLayout ? middleWidth + "+" + this.id+".offsetWidth-"+containerWidth : this.id+".offsetWidth"); }
				if(this._bottom){ bottomStyle.setExpression("width", sidebarLayout ? middleWidth + "+" + this.id+".offsetWidth-"+containerWidth : this.id+".offsetWidth"); }
			}
		}

		dojo.forEach(this.getChildren(), function(child){ child.resize && child.resize(); });
	}
});

// This argument can be specified for the children of a BorderContainer.
// Since any widget can be specified as a LayoutContainer child, mix it
// into the base widget class.  (This is a hack, but it's effective.)
dojo.extend(dijit._Widget, {
	// region: String
	//		"top", "bottom", "leading", "trailing", "left", "right", "center".
	//		See the BorderContainer description for details on this parameter.
	region: 'none',

	// splitter: Boolean
	splitter: false,

	// minSize: Number
	minSize: 0,

	// maxSize: Number
	maxSize: Infinity
});

dojo.require("dijit._Templated");

dojo.declare("dojox.layout._Splitter", [ dijit._Widget, dijit._Templated ],
{
/*=====
	container: null,
	child: null,
	region: null,
=====*/

	// live: Boolean
	//		If true, the child's size changes and the child widget is redrawn as you drag the splitter;
	//		otherwise, the size doesn't change until you drop the splitter (by mouse-up)
	live: true,

	// summary: A draggable spacer between two items in a BorderContainer
	templateString: '<div class="dijitSplitter" dojoAttachEvent="onkeypress:_onKeyPress,onmousedown:_startDrag" style="position: absolute; z-index: 9999" tabIndex="0"><div class="dijitSplitterThumb"></div></div>',

	postCreate: function(){
		this.inherited("postCreate", arguments);
		this.horizontal = /top|bottom/.test(this.region);
		dojo.addClass(this.domNode, "dijitSplitter" + (this.horizontal ? "Horizontal" : "Vertical"));

		this._factor = /top|left/.test(this.region) ? 1 : -1;
		this._minSize = this.child.minSize;
	},

	_startDrag: function(e){
		dojo.addClass(this.domNode, "dijitSplitterActive");
		this._resize = this.live;
		var horizontal = this.horizontal;
		this._pageStart = horizontal ? e.pageY : e.pageX;
		var dim = horizontal ? 'h' : 'w';
		this._childStart = dojo.marginBox(this.child.domNode)[dim];
		if(dojo.isSafari){
			var axis = horizontal ? 'y' : 'x';
			this._splitterStart = dojo.coords(this.domNode)[axis] - dojo.coords(this.container.domNode)[axis];
		}else{
			var edge = horizontal ? 't' : 'l';
			this._splitterStart = dojo.marginBox(this.domNode)[edge] - dojo.marginBox(this.container.domNode)[edge];
		}
		this._handlers = [
				dojo.connect(dojo.doc, "onmousemove", this, "_drag"),
				dojo.connect(dojo.doc, "onmouseup", this, "_stopDrag")
			];
		this._computeMaxSize();
		dojo.stopEvent(e);
	},

	_computeMaxSize: function(){
		var dim = this.horizontal ? 'h' : 'w';
		var available = dojo.marginBox(this.container.domNode)[dim] - (this.oppNode ? dojo.marginBox(this.oppNode)[dim] : 0);
		var fudge = 10; //TODO: specify? use width of splitter?
		this._maxSize = Math.min(this.child.maxSize, available - fudge * this._factor);
	},

	_drag: function(e){
		var delta = (this.horizontal ? e.pageY : e.pageX) - this._pageStart;
		if(this._resize){
			this._move(delta, this._childStart);
		}else{
			//TODO: min/max constraints
			var splitterEdge = delta + this._splitterStart;
			this.domNode.style[ this.horizontal ? "top" : "left" ] = splitterEdge + "px";
		}
	},

	_stopDrag: function(e){
		try{
			dojo.removeClass(this.domNode, "dijitSplitterActive");
			this._drag(e);
			this._resize = true;
			this._drag(e);
		}finally{
			this._cleanupHandlers();
		}
	},

	_cleanupHandlers: function(){
		dojo.forEach(this._handlers, dojo.disconnect);
		delete this._handlers;
	},

	_onKeyPress: function(/*Event*/ e){
		// should we apply typematic to this?
		this._resize = true;
		var horizontal = this.horizontal;
		var tick = 1;
		switch(e.keyCode){
			case horizontal ? dojo.keys.UP_ARROW : dojo.keys.LEFT_ARROW:
				tick *= -1;
				break;
			case horizontal ? dojo.keys.DOWN_ARROW : dojo.keys.RIGHT_ARROW:
				break;
			default:
//				this.inherited("_onKeyPress", arguments);
				return;
		}
		this._computeMaxSize();
		this._move(tick, dojo.marginBox(this.child.domNode)[ horizontal ? 'h' : 'w' ]);
		dojo.stopEvent(e);
	},

	_move: function(/*Number*/delta, oldChildSize){
		var childStart = oldChildSize;
		var childSize = this._factor * delta + childStart;
		this.child.domNode.style[ this.horizontal ? "height" : "width" ] =
			Math.max(Math.min(childSize, this._maxSize), this._minSize) + "px";
		this.container.layout();
	},

	destroy: function(){
		this._cleanupHandlers();
		delete this.child;
		delete this.container;
		this.inherited("destroy", arguments);
	}
});
