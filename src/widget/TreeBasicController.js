
dojo.provide("dojo.widget.TreeBasicController");

dojo.require("dojo.event.*");
dojo.require("dojo.json")
dojo.require("dojo.io.*");


dojo.widget.tags.addParseTreeHandler("dojo:TreeBasicController");


dojo.widget.TreeBasicController = function() {
	dojo.widget.HtmlWidget.call(this);
}

dojo.inherits(dojo.widget.TreeBasicController, dojo.widget.HtmlWidget);


dojo.lang.extend(dojo.widget.TreeBasicController, {
	widgetType: "TreeBasicController",

	DNDController: "",


	initialize: function(args, frag){

		/* no DND by default for compatibility */
		if (this.DNDController == "create") {
			dojo.require("dojo.dnd.TreeDragAndDrop");
			this.DNDController = new dojo.dnd.TreeDNDController(this);
		}
		else if (this.DNDController) {
			this.DNDController = dojo.widget.byId(this.DNDController);
		}


	},


	/**
	 * Binds controller to all tree events
	*/
	listenTree: function(tree) {
		//dojo.debug("Event "+tree.eventNames.treeClick);
		dojo.event.topic.subscribe(tree.eventNames.createDOMNode, this, "onCreateDOMNode");
		dojo.event.topic.subscribe(tree.eventNames.treeClick, this, "onTreeClick");
		dojo.event.topic.subscribe(tree.eventNames.treeCreate, this, "onTreeCreate");

		if (this.DNDController) {
			this.DNDController.listenTree(tree);
		}
	},

	onCreateDOMNode: function(message) {

		var node = message.source;


		if (node.expandLevel > 0) {
			//dojo.debug(node.expandLevel);
			this.expandToLevel(node, node.expandLevel);
		}
	},

	// perform actions-initializers for tree
	onTreeCreate: function(message) {
		var tree = message.source;
		var _this = this;
		if (tree.expandLevel) {
			dojo.lang.forEach(tree.children,
				function(child) { _this.expandToLevel(child, tree.expandLevel-1) }
			);
		}
	},

	expandToLevel: function(node, level) {
		if (level == 0) return;

		var children = node.children;
		var _this = this;

		var handler = function(node, expandLevel) {
			this.node = node;
			this.expandLevel = expandLevel;
			// recursively expand opened node
			this.process = function() {
				//dojo.debug("Process "+node+" level "+level);
				for(var i=0; i<this.node.children.length; i++) {
					var child = node.children[i];

					_this.expandToLevel(child, this.expandLevel);
				}
			};
		}

		var h = new handler(node, level-1);


		this.expand(node, false, h, h.process);

	},




	onTreeClick: function(message){
		var node = message.source;

		//dojo.debug("Subscribed to "+node);

		if (node.isExpanded){
			this.collapse(node);
		} else {
			this.expand(node);
		}
	},

	expand: function(node, sync, callObj, callFunc) {
		//dojo.debug(node);
		node.expand();
		if (callFunc) callFunc.apply(callObj, [node]);
	},

	collapse: function(node) {
		node.collapse();
	},

// =============================== move ============================

	/**
	 * Checks whether it is ok to change parent of child to newParent
	 * May incur type checks etc
	 *
	 * It should check only hierarchical possibility w/o index, etc
	 * because in onDragOver event for Between DND mode we can't calculate index at once on onDragOVer.
	 * index changes as client moves mouse up-down over the node
	 */
	canMove: function(child, newParent){

		if (child.actionIsDisabled(child.actions.MOVE)) {
			return false;
		}

		if (child.parent !== newParent && newParent.actionIsDisabled(newParent.actions.ADDCHILD)) {
			return false;
		}

		// Can't move parent under child. check whether new parent is child of "child".
		var node = newParent;
		while(node.isTreeNode) {
			//dojo.debugShallow(node.title)
			if (node === child) {
				// parent of newParent is child
				return false;
			}
			node = node.parent;
		}


		// check for newParent being a folder (if node)
		if (newParent.isTreeNode && !newParent.isFolder) {
			return false;
		}

		return true;
	},


	move: function(child, newParent, index) {

		/* move sourceTreeNode to new parent */
		if (!this.canMove(child, newParent)) {
			return false;
		}

		var result = this.doMove(child, newParent, index);

		if (!result) return result;

		if (newParent.isTreeNode) {
			this.expand(newParent);
		}

		return result;
	},

	doMove: function(child, newParent, index) {
		child.tree.move(child, newParent, index);

		return true;
	},

// =============================== removeNode ============================


	canRemoveNode: function(child) {
		if (child.actionIsDisabled(child.actions.REMOVE)) {
			return false;
		}

		return true;
	},


	removeNode: function(node, callFunc, callObj) {
		if (!this.canRemoveNode(node)) {
			return false;
		}

		return this.doRemoveNode(node, callFunc, callObj);
	},


	doRemoveNode: function(node, callFunc, callObj) {
		node.tree.removeNode(node);

		if (callFunc) {
			callFunc.apply(dojo.lang.isUndefined(callObj) ? this : callObj, [node]);
		}
	},


	// -----------------------------------------------------------------------------
	//                             Create node stuff
	// -----------------------------------------------------------------------------


	canCreateChild: function(parent, index, data) {
		if (!parent.isFolder) return false;

		return true;
	},


	/* send data to server and add child from server */
	/* data may contain an almost ready child, or anything else, suggested to server */
	/*in RPC controllers server responds with child data to be inserted */
	createChild: function(parent, index, data, callFunc, callObj) {
		if (!this.canCreateChild(parent, index, data)) {
			return false;
		}

		return this.doCreateChild.apply(this, arguments);
	},

	doCreateChild: function(parent, index, data, callFunc, callObj) {

		var widgetType = data.widgetType ? data.widgetType : "TreeNode";

		var newChild = dojo.widget.createWidget(widgetType, data);

		parent.addChild(newChild, index);

		this.expand(parent);

		if (callFunc) {
			callFunc.apply(callObj, [newChild]);
		}

		return newChild;
	}



});
