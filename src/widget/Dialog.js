dojo.provide("dojo.widget.Dialog");

dojo.require("dojo.widget.*");
dojo.require("dojo.widget.ContentPane");
dojo.require("dojo.event.*");
dojo.require("dojo.graphics.color");
dojo.require("dojo.html.layout");
dojo.require("dojo.html.display");
dojo.require("dojo.html.iframe");

dojo.widget.defineWidget(
	"dojo.widget.Dialog",
	dojo.widget.ContentPane,
	{
		templatePath: dojo.uri.dojoUri("src/widget/templates/HtmlDialog.html"),
		isContainer: true,
		_scrollConnected: false,
		
		// provide a focusable element or element id if you need to
		// work around FF's tendency to send focus into outer space on hide
		focusElement: "",

		bg: null,
		bgColor: "black",
		bgOpacity: 0.4,
		followScroll: true,
		_fromTrap: false,
		anim: null,
		blockDuration: 0,
		lifetime: 0,

		trapTabs: function(e){
			if(e.target == this.tabStart) {
				if(this._fromTrap) {
					this._fromTrap = false;
				} else {
					this._fromTrap = true;
					this.tabEnd.focus();
				}
			} else if(e.target == this.tabEnd) {
				if(this._fromTrap) {
					this._fromTrap = false;
				} else {
					this._fromTrap = true;
					this.tabStart.focus();
				}
			}
		},

		clearTrap: function(e) {
			var _this = this;
			setTimeout(function() {
				_this._fromTrap = false;
			}, 100);
		},

		postCreate: function(args, frag, parentComp) {
			with(this.domNode.style) {
				position = "absolute";
				zIndex = 999;
				display = "none";
				overflow = "visible";
			}
			var b = dojo.body();
			b.appendChild(this.domNode);

			this.bg = document.createElement("div");
			this.bg.className = "dialogUnderlay";
			with(this.bg.style) {
				position = "absolute";
				left = top = "0px";
				zIndex = 998;
				display = "none";
			}
			this.setBackgroundColor(this.bgColor);
			b.appendChild(this.bg);

			this.bgIframe = new dojo.html.BackgroundIframe(this.bg);
		},

		setBackgroundColor: function(color) {
			if(arguments.length >= 3) {
				color = new dojo.graphics.color.Color(arguments[0], arguments[1], arguments[2]);
			} else {
				color = new dojo.graphics.color.Color(color);
			}
			this.bg.style.backgroundColor = color.toString();
			return this.bgColor = color;
		},
		
		setBackgroundOpacity: function(op) {
			if(arguments.length == 0) { op = this.bgOpacity; }
			dojo.html.setOpacity(this.bg, op);
			try {
				this.bgOpacity = dojo.html.getOpacity(this.bg);
			} catch (e) {
				this.bgOpacity = op;
			}
			return this.bgOpacity;
		},

		sizeBackground: function() {
			if(this.bgOpacity > 0) {
				var viewport = dojo.html.getViewport();
				var h = Math.max(
					dojo.doc().documentElement.scrollHeight || dojo.body().scrollHeight,
					viewport.height);
				var w = viewport.width;
				this.bg.style.width = w + "px";
				this.bg.style.height = h + "px";
			}
			this.bgIframe.onResized();
		},

		showBackground: function() {
			this.sizeBackground();
			if(this.bgOpacity > 0) {
				this.bg.style.display = "block";
			}
		},

		placeDialog: function() {
			var scroll_offset = dojo.html.getScroll().offset;
			var viewport_size = dojo.html.getViewport();

			// find the size of the dialog
			var mb = dojo.html.getMarginBox(this.containerNode);

			var x = scroll_offset.x + (viewport_size.width - mb.width)/2;
			var y = scroll_offset.y + (viewport_size.height - mb.height)/2;

			with(this.domNode.style) {
				left = x + "px";
				top = y + "px";
			}
		},

		show: function() {
			this.setBackgroundOpacity();
			this.showBackground();

			dojo.widget.Dialog.superclass.show.call(this);

			// FIXME: moz doesn't generate onscroll events for mouse or key scrolling (wtf)
			// we should create a fake event by polling the scrolltop/scrollleft every X ms.
			// this smells like it should be a dojo feature rather than just for this widget.

			if (this.followScroll && !this._scrollConnected){
				this._scrollConnected = true;
				dojo.event.connect(window, "onscroll", this, "onScroll");
			}
			
			if(this.lifetime){
				this.timeRemaining = this.lifetime;
				if(!this.blockDuration){
					dojo.event.connect(this.bg, "onclick", this, "hide");
				}else{
					dojo.event.disconnect(this.bg, "onclick", this, "hide");
				}
				if(this.timerNode){
					this.timerNode.innerHTML = Math.ceil(this.timeRemaining/1000);
				}
				if(this.blockDuration && this.closeNode){
					if(this.lifetime > this.blockDuration){
						this.closeNode.style.visibility = "hidden";
					}else{
						this.closeNode.style.display = "none";
					}
				}
				this.timer = setInterval(dojo.lang.hitch(this, "onTick"), 100);
			}

			this.checkSize();
		},

		onLoad: function(){
			// when href is specified we need to reposition
			// the dialog after the data is loaded
			this.placeDialog();
		},
		
		fillInTemplate: function(){
			// dojo.event.connect(this.domNode, "onclick", this, "killEvent");
		},

		hide: function(){
			// workaround for FF focus going into outer space
			if (this.focusElement) { 
				dojo.byId(this.focusElement).focus(); 
				dojo.byId(this.focusElement).blur();
			}
			
			if(this.timer){
				clearInterval(this.timer);
			}

			this.bg.style.display = "none";
			this.bg.style.width = this.bg.style.height = "1px";

			dojo.widget.Dialog.superclass.hide.call(this);

			if (this._scrollConnected){
				this._scrollConnected = false;
				dojo.event.disconnect(window, "onscroll", this, "onScroll");
			}
		},
		
		setTimerNode: function(node){
			this.timerNode = node;
		},

		setCloseControl: function(node) {
			this.closeNode = node;
			dojo.event.connect(node, "onclick", this, "hide");
		},

		setShowControl: function(node) {
			dojo.event.connect(node, "onclick", this, "show");
		},
		
		onTick: function(){
			if(this.timer){
				this.timeRemaining -= 100;
				if(this.lifetime - this.timeRemaining >= this.blockDuration){
					dojo.event.connect(this.bg, "onclick", this, "hide");
					if(this.closeNode){
						this.closeNode.style.visibility = "visible";
					}
				}
				if(!this.timeRemaining){
					clearInterval(this.timer);
					this.hide();
				}else if(this.timerNode){
					this.timerNode.innerHTML = Math.ceil(this.timeRemaining/1000);
				}
			}
		},

		onScroll: function(){
			this.placeDialog();
			this.domNode.style.display = "block";
		},

		// Called when the browser window's size is changed
		checkSize: function() {
			if(this.isShowing()){
				this.sizeBackground();
				this.placeDialog();
				this.domNode.style.display="block";
				this.onResized();
			}
		},
		
		killEvent: function(evt){
			evt.preventDefault();
			evt.stopPropagation();
		}

	}
);
