dojo.provide("dojo.widget.Toaster");

dojo.require("dojo.widget.*");
dojo.require("dojo.lfx.*");

// This is mostly taken from Jesse Kuhnert's MessageNotifier.
// Modified by Bryan Forbes to support topics and a variable delay.

dojo.widget.defineWidget(
	"dojo.widget.Toaster",
	dojo.widget.HtmlWidget,
	{
		templateString: '<div dojoAttachPoint="clipNode"><div dojoAttachPoint="containerNode" dojoAttachEvent="onClick:onSelect"><div dojoAttachPoint="contentNode"></div></div></div>',
		templateCssPath: dojo.uri.dojoUri("src/widget/templates/HtmlToaster.css"),
		
		clipNode: null,

		messageTopic: "",
		contentNode: null,
		
		// possible message types
		messageTypes: {
			MESSAGE: "MESSAGE",
			WARNING: "WARNING",
			ERROR: "ERROR",
			FATAL: "FATAL"
		},

		// css classes
		clipCssClass: "dojoToasterClip",
		containerCssClass: "dojoToasterContainer",
		contentCssClass: "dojoToasterContent",
		messageCssClass: "dojoToasterMessage",
		warningCssClass: "dojoToasterWarning",
		errorCssClass: "dojoToasterError",
		fatalCssClass: "dojoToasterFatal",
		
		positionDirection: "br-up",
		positionDirectionTypes: ["br-up", "br-left", "bl-up", "bl-right", "tr-down", "tr-left", "tl-down", "tl-right"],
		showDelay: 2000,

		slideAnim: null,
		fadeAnim: null,

		postCreate: function(){
			this.hide();
			dojo.html.setClass(this.clipNode, this.clipCssClass);
			dojo.html.addClass(this.containerNode, this.containerCssClass);
			dojo.html.setClass(this.contentNode, this.contentCssClass);
			if(this.messageTopic){
				dojo.event.topic.subscribe(this.messageTopic, this, "setContent");
			}
			if(!this.positionDirection || !dojo.lang.inArray(this.positionDirectionTypes, this.positionDirection)){
				this.positionDirection = this.positionDirectionTypes.BRU;
			}
		},

		setContent: function(msg, messageType){
			// sync animations so there are no ghosted fades and such
			if(this.slideAnim && this.slideAnim.status() == "playing"){
				dojo.lang.setTimeout(50, dojo.lang.hitch(this, function(){
					this.setContent(msg, messageType);
				}));
				return;
			}else if(this.slideAnim){
				this.slideAnim.stop();
				if(this.fadeAnim) this.fadeAnim.stop();
			}
			if(!msg){
				dojo.debug(this.widgetId + ".setContent() incoming content was null, ignoring.");
				return;
			}
			if(!this.positionDirection || !dojo.lang.inArray(this.positionDirectionTypes, this.positionDirection)){
				dojo.raise(this.widgetId + ".positionDirection is an invalid value: " + this.positionDirection);
			}

			// determine type of content and apply appropriately
			dojo.html.removeClass(this.containerNode, this.messageCssClass);
			dojo.html.removeClass(this.containerNode, this.warningCssClass);
			dojo.html.removeClass(this.containerNode, this.errorCssClass);
			dojo.html.removeClass(this.containerNode, this.fatalCssClass);

			dojo.html.clearOpacity(this.containerNode);
			
			if(msg instanceof String || typeof msg == "string"){
				this.contentNode.innerHTML = msg;
			}else if(dojo.html.isNode(msg)){
				this.contentNode.innerHTML = dojo.html.getContentAsString(msg);
			}else{
				dojo.raise("Toaster.setContent(): msg is of unknown type:" + msg);
			}

			switch(messageType){
				case this.messageTypes.WARNING:
					dojo.html.addClass(this.containerNode, this.warningCssClass);
					break;
				case this.messageTypes.ERROR:
					dojo.html.addClass(this.containerNode, this.errorCssClass);
					break
				case this.messageTypes.FATAL:
					dojo.html.addClass(this.containerNode, this.fatalCssClass);
					break;
				case this.messageTypes.MESSAGE:
				default:
					dojo.html.addClass(this.containerNode, this.messageCssClass);
					break;
			}

			// now do funky animation of widget appearing from
			// bottom right of page and up
			var view = dojo.html.getViewport();
			var scroll = dojo.html.getScroll();

			this.show();

			var nodeSize = dojo.html.getMarginBox(this.containerNode);
			var endCoords = { top: 0, left: 0 };

			// TODO: Add scroll change event lisener similar to Dialog.js widget so
			// that notify window stays with bottom of screen when it is moved

			// sets up the size of the clipping node
			this.clipNode.style.height = nodeSize.height+"px";
			this.clipNode.style.width = nodeSize.width+"px";

			// sets up the position of the clipping node
			if(this.positionDirection.match(/^t/)){
				this.clipNode.style.top = scroll.top+"px";
			}else if(this.positionDirection.match(/^b/)){
				this.clipNode.style.top = (view.height - nodeSize.height - 2 + scroll.top)+"px";
			}
			if(this.positionDirection.match(/^[tb]r-/)){
				this.clipNode.style.left = (view.width - nodeSize.width - 1 - scroll.left)+"px";
			}else if(this.positionDirection.match(/^[tb]l-/)){
				this.clipNode.style.left = 0 + "px";
			}

			this.clipNode.style.clip = "rect(0px, " + nodeSize.width + "px, " + nodeSize.height + "px, 0px)";

			// sets up initial position of container node and slide-out direction
			if(this.positionDirection.indexOf("-up") >= 0){
				this.containerNode.style.left=0+"px";
				this.containerNode.style.top=nodeSize.height + 10 + "px";
			}else if(this.positionDirection.indexOf("-left") >= 0){
				this.containerNode.style.left=nodeSize.width + 10 +"px";
				this.containerNode.style.top=0+"px";
			}else if(this.positionDirection.indexOf("-right") >= 0){
				this.containerNode.style.left = 0 - nodeSize.width - 10 + "px";
				this.containerNode.style.top = 0+"px";
			}else if(this.positionDirection.indexOf("-down") >= 0){
				this.containerNode.style.left = 0+"px";
				this.containerNode.style.top = 0 - nodeSize.height - 10 + "px";
			}else{
				dojo.raise(this.widgetId + ".positionDirection is an invalid value: " + this.positionDirection);
			}

			this.slideAnim = dojo.lfx.html.slideTo(
				this.containerNode,
				{ top: 0, left: 0 },
				450,
				null,
				dojo.lang.hitch(this, function(nodes, anim){
					dojo.html.removeClass(dojo.body(), this.overflowCssClass);
					dojo.lang.setTimeout(dojo.lang.hitch(this, function(evt){
						// can't do a fadeHide because we're fading the
						// inner node rather than the clipping node
						this.fadeAnim = dojo.lfx.html.fadeOut(
							this.containerNode,
							1000,
							null,
							dojo.lang.hitch(this, function(evt){
								this.hide();
								dojo.html.setOpacity(this.containerNode, 1.0);
							})).play();
					}), this.showDelay);
				})).play();
		},

		onSelect: function(e) { }
	},
	"html"
);
