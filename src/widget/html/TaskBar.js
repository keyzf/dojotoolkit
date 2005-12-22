dojo.provide("dojo.widget.html.TaskBar");
dojo.provide("dojo.widget.html.TaskBarItem");

dojo.require("dojo.widget.*");
dojo.require("dojo.widget.Toggler");
dojo.require("dojo.widget.FloatingPane");
dojo.require("dojo.widget.HtmlWidget");
dojo.require("dojo.event");

// Icon associated w/a floating pane
dojo.widget.html.TaskBarItem = function(){
	dojo.widget.TaskBarItem.call(this);
	dojo.widget.HtmlWidget.call(this);
}
dojo.inherits(dojo.widget.html.TaskBarItem, dojo.widget.HtmlWidget);

dojo.lang.extend(dojo.widget.html.TaskBarItem, {
	// constructor arguments
	iconSrc: '',
	caption: 'Untitled',
	task: null,
	iconWidth: 18,
	iconHeight: 18,
	templatePath: dojo.uri.dojoUri("src/widget/templates/HtmlTaskBarItemTemplate.html"),
	templateCssPath: dojo.uri.dojoUri("src/widget/templates/HtmlTaskBar.css"),

	fillInTemplate: function() {
		if ( this.iconSrc != '' ) {
			var img = document.createElement("img");
			img.src = this.iconSrc;
			img.width = this.iconWidth;
			img.height = this.iconHeight;
			this.domNode.appendChild(img);
		}
		this.domNode.appendChild(document.createTextNode(this.caption));
		dojo.html.disableSelection(this.domNode);
	},

	postCreate: function() {
		this.task.explodeSrc = this.domNode;
	},

	onClick: function() {
		this.task.doToggle();
	}
});

// Collection of widgets in a bar, like Windows task bar
dojo.widget.html.TaskBar = function(){

	dojo.widget.html.FloatingPane.call(this);
	dojo.widget.TaskBar.call(this);
	this.titleBarDisplay = "none";
}

dojo.inherits(dojo.widget.html.TaskBar, dojo.widget.html.FloatingPane);

dojo.lang.extend(dojo.widget.html.TaskBar, {
});
