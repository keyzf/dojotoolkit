
dojo.provide("dojo.widget.TreeDocIconExtension");

dojo.require("dojo.widget.HtmlWidget");
dojo.require("dojo.widget.TreeExtension");

// selector extension to emphase node

dojo.widget.defineWidget(
	"dojo.widget.TreeDocIconExtension",
	[dojo.widget.TreeExtension],
{
	/**
	 * can't unlisten
	 */
	
	templateCssPath: dojo.uri.dojoUri("src/widget/templates/TreeDocIcon.css"),

	
	listenTreeEvents: ["afterChangeTree","afterSetFolder","afterUnsetFolder"],
	
	listenNodeFilter: function(elem) { return elem instanceof dojo.widget.Widget },
	
	getNodeType: function(node) {
		var nodeType = node.getNodeType();
		if (!nodeType) { // set default type
			nodeType = node.isFolder ? "Folder" : "Document";
		}
		return nodeType;
	},
	
	setNodeTypeClass: function(node) {
		
		var reg = new RegExp("(^|\\s)"+node.tree.classPrefix+"Icon\\w+",'g');			
				
		var clazz = dojo.html.getClass(node.iconNode).replace(reg,'') + ' ' + node.tree.classPrefix+'Icon'+this.getNodeType(node);
		dojo.html.setClass(node.iconNode, clazz);		
	},
		
		
	onAfterSetFolder: function(message) {
		//dojo.debug("FOLDER");
		if (message.source.iconNode) {
			// on node-initialize time when folder is set there is no iconNode
			// this case will be processed in treeChange anyway			
			this.setNodeTypeClass(message.source);
		}
	},
	
	
	onAfterUnsetFolder: function(message) {
		this.setNodeTypeClass(message.source);
	},
		
	
	listenNode: function(node) {
		/**
		 * add node with document type icon to node template and Tree.iconNodeTemplate
		 * it will be set to TreeNode.iconNode on node creation
		 * we do not assign document type yet, its node specific
		 */
		//dojo.debug("listenNode in "+node);
			
		node.contentIconNode = document.createElement("div");
		var clazz = node.tree.classPrefix+"IconContent";
		if (dojo.render.html.ie) {
			clazz = clazz+' '+ node.tree.classPrefix+"IEIconContent";
		}
		dojo.html.setClass(node.contentIconNode, clazz);
		
		node.contentNode.parentNode.replaceChild(node.contentIconNode, node.expandNode);
									  
	  	node.iconNode = document.createElement("div");
		dojo.html.setClass(node.iconNode, node.tree.classPrefix+"Icon"+' '+node.tree.classPrefix+'Icon'+this.getNodeType(node));
		
		node.contentIconNode.appendChild(node.expandNode);
		node.contentIconNode.appendChild(node.iconNode);
		
		dojo.dom.removeNode(node.contentNode);
		node.contentIconNode.appendChild(node.contentNode);
		
	
		
		//dojo.html.insertAfter(node.iconNode, node.expandNode);
		
		//dojo.debug("listenNode out "+node);
		
	},
			
	
	onAfterChangeTree: function(message) {
		var _this = this;
		
		//dojo.debug(message.node)
		
		if (!message.oldTree || !this.listenedTrees[message.oldTree.widgetId]) {			
			// moving from old tree to our tree
			this.processDescendants(message.node,
				this.listenNodeFilter,
				this.listenNode
			);
		}
		
	}
	

});
