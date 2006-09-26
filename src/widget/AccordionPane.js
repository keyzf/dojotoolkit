dojo.provide("dojo.widget.AccordionPane");

dojo.require("dojo.widget.*");
dojo.require("dojo.html.*");
dojo.require("dojo.html.selection");
dojo.require("dojo.widget.html.layout");

/*
 * AccordionPane is a box with a title that contains another widget (often a ContentPane).
 * It works in conjunction w/an AccordionContainer.
 */
dojo.widget.defineWidget(
	"dojo.widget.AccordionPane",
	dojo.widget.HtmlWidget,
{
	// parameters

	// String
	//	Label to print on top of AccordionPane
	label: "",

	// String
	//	class string for the AccordionPane's dom node
	"class": "dojoAccordionPane",

	// String
	//	class string for the AccordionPane's label node
	labelNodeClass: "label",

	// String
	//	class string for the AccordionPane's container node
	containerNodeClass: "accBody",
	
	// Boolean
	//	If true, this is the open pane
	open: false,

	templatePath: dojo.uri.dojoUri("src/widget/templates/AccordionPane.html"),
	templateCssPath: dojo.uri.dojoUri("src/widget/templates/AccordionPane.css"),

	isContainer: true,

	// methods
    fillInTemplate: function() {
    	dojo.html.addClass(this.domNode, this["class"]);
		dojo.widget.AccordionPane.superclass.fillInTemplate.call(this);
		dojo.html.disableSelection(this.labelNode);
		this.setSelected(this.open);
	},

	setLabel: function(label) {
		this.labelNode.innerHTML=label;
	},
	
	resizeTo: function(width, height){
		dojo.html.setMarginBox(this.domNode, {width: width, height: height});
		var children = [
			{domNode: this.labelNode, layoutAlign: "top"},
			{domNode: this.containerNode, layoutAlign: "client"}
		];
		dojo.widget.html.layout(this.domNode, children);
		var childSize = dojo.html.getContentBox(this.containerNode);
		this.children[0].resizeTo(childSize.width, childSize.height);
	},

	getLabelHeight: function() {
		return dojo.html.getMarginBox(this.labelNode).height;
	},

	onLabelClick: function() {
		this.parent.selectPage(this);
	},
	
	setSelected: function(/*Boolean*/ isSelected){
		this.open=isSelected;
		(isSelected ? dojo.html.addClass : dojo.html.removeClass)(this.domNode, this["class"]+"-selected");
	}
});
