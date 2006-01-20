dojo.provide("dojo.widget.HtmlWidget");
dojo.require("dojo.widget.DomWidget");
dojo.require("dojo.html");
dojo.require("dojo.string");

dojo.widget.HtmlWidget = function(args){
	// mixin inheritance
	dojo.widget.DomWidget.call(this);
}

dojo.inherits(dojo.widget.HtmlWidget, dojo.widget.DomWidget);

dojo.lang.extend(dojo.widget.HtmlWidget, {
	widgetType: "HtmlWidget",

	templateCssPath: null,
	templatePath: null,
	allowResizeX: true,
	allowResizeY: true,

	resizeGhost: null,
	initialResizeCoords: null,

	// for displaying/hiding widget
	toggle: "plain",
	toggleDuration: 150,

	animationInProgress: false,

	initialize: function(args, frag){
	},

	postMixInProperties: function(args, frag){
		// now that we know the setting for toggle, define show()&hide()
		dojo.lang.mixin(this,
			dojo.widget.HtmlWidget.Toggle[dojo.string.capitalize(this.toggle)] ||
			dojo.widget.HtmlWidget.Toggle.Plain);
	},

	getContainerHeight: function(){
		// NOTE: container height must be returned as the INNER height
		dj_unimplemented("dojo.widget.HtmlWidget.getContainerHeight");
	},

	getContainerWidth: function(){
		return this.parent.domNode.offsetWidth;
	},

	setNativeHeight: function(height){
		var ch = this.getContainerHeight();
	},

	resizeSoon: function(){
		if(this.isVisible()){
			dojo.lang.setTimeout(this, this.onResized, 0);
		}
	},

	createNodesFromText: function(txt, wrap){
		return dojo.html.createNodesFromText(txt, wrap);
	},

	_old_buildFromTemplate: dojo.widget.DomWidget.prototype.buildFromTemplate,

	buildFromTemplate: function(args, frag){
		if(dojo.widget.DomWidget.templates[this.widgetType]){
			var ot = dojo.widget.DomWidget.templates[this.widgetType];
			dojo.widget.DomWidget.templates[this.widgetType] = {};
		}
		if(args["templatecsspath"]){
			args["templateCssPath"] = args["templatecsspath"];
		}
		if(args["templatepath"]){
			args["templatePath"] = args["templatepath"];
		}
		dojo.widget.buildFromTemplate(this, args["templatePath"], args["templateCssPath"]);
		this._old_buildFromTemplate(args, frag);
		dojo.widget.DomWidget.templates[this.widgetType] = ot;
	},

	destroyRendering: function(finalize){
		try{
			var tempNode = this.domNode.parentNode.removeChild(this.domNode);
			if(!finalize){
				dojo.event.browser.clean(tempNode);
			}
			delete tempNode;
		}catch(e){ /* squelch! */ }
	},

	// Displaying/hiding the widget

	isVisible: function(){
		return dojo.html.isVisible(this.domNode);
	},
	doToggle: function(){
		this.isVisible() ? this.hide() : this.show();
	},
	show: function(){
		this.animationInProgress=true;
		this.showMe();
	},
	onShow: function(){
		this.animationInProgress=false;
	},
	hide: function(){
		this.animationInProgress=true;
		this.hideMe();
	},
	onHide: function(){
		this.animationInProgress=false;
	}
});


/**** 
	Strategies for displaying/hiding widget
*****/

dojo.widget.HtmlWidget.Toggle={}

dojo.widget.HtmlWidget.Toggle.Plain = {
	showMe: function(){
		dojo.html.show(this.domNode);
		if(dojo.lang.isFunction(this.onShow)){ this.onShow(); }
	},

	hideMe: function(){
		dojo.html.hide(this.domNode);
		if(dojo.lang.isFunction(this.onHide)){ this.onHide(); }
	}
}

dojo.widget.HtmlWidget.Toggle.Fade = {
	showMe: function(){
		dojo.fx.html.fadeShow(this.domNode, this.toggleDuration, dojo.lang.hitch(this, this.onShow));
	},

	hideMe: function(){
		dojo.fx.html.fadeHide(this.domNode, this.toggleDuration, dojo.lang.hitch(this, this.onHide));
	}
}

dojo.widget.HtmlWidget.Toggle.Wipe = {
	showMe: function(){
		dojo.fx.html.wipeIn(this.domNode, this.toggleDuration, dojo.lang.hitch(this, this.onShow));
	},

	hideMe: function(){
		dojo.fx.html.wipeOut(this.domNode, this.toggleDuration, dojo.lang.hitch(this, this.onHide));
	}
}

dojo.widget.HtmlWidget.Toggle.Explode = {
	showMe: function(){
		dojo.fx.html.explode(this.explodeSrc||[0,0,0,0], this.domNode, this.toggleDuration,
			dojo.lang.hitch(this, this.onShow));
	},

	hideMe: function(){
		dojo.fx.html.implode(this.domNode, this.explodeSrc||[0,0,0,0], this.toggleDuration,
			dojo.lang.hitch(this, this.onHide));
	}
}
