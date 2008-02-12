dojo.provide("dijit.form.SimpleTextarea");

dojo.require("dijit.form._FormWidget");

dojo.declare("dijit.form.SimpleTextarea",
	dijit.form._FormValueWidget,
{
	// summary:
	//		A simple textarea that degrades, and responds to
	// 		minimal LayoutContainer usage, and works with dijit.form.Form.
	//		Doesn't automatically size according to input, like Textarea.
	//
	// example:
	//	|	<textarea dojoType="dijit.form.SimpleTextarea" name="foo" value="bar" rows=30 cols=40/>
	//

	attributeMap: dojo.mixin(dojo.clone(dijit.form._FormValueWidget.prototype.attributeMap),
		{rows:"focusNode", cols: "focusNode"}),

	// rows: Number
	//		The number of rows of text.
	rows: "",

	// rows: Number
	//		The number of characters per line.
	cols: "",

	templateString: "<textarea class='dijitTextArea' name='${name}' dojoAttachPoint='focusNode,containerNode'>",

	postMixInProperties: function(){
		if(this.srcNodeRef){
			this.value = this.srcNodeRef.value;
		}
	},

	setValue: function(/*String*/ val){
		this.domNode.value = this.value = val;
		this.inherited(arguments);
	},

	getValue: function(){
		return this.domNode.value;
	}
});
