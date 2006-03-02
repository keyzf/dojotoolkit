
dojo.provide("dojo.widget.TreeNode");

dojo.require("dojo.event.*");
dojo.require("dojo.fx.html");
dojo.require("dojo.io.*");

// make it a tag
dojo.widget.tags.addParseTreeHandler("dojo:TreeNode");


// # //////////

dojo.widget.TreeNode = function() {
	dojo.widget.HtmlWidget.call(this);

	this.actionsDisabled = [];
}

dojo.inherits(dojo.widget.TreeNode, dojo.widget.HtmlWidget);

dojo.lang.extend(dojo.widget.TreeNode, {
	widgetType: "TreeNode",

	loadStates: {
		UNCHECKED: "UNCHECKED",
    	LOADING: "LOADING",
    	LOADED: "LOADED"
	},


	actions: {
		MOVE: "MOVE",
    	REMOVE: "REMOVE",
    	EDIT: "EDIT",
    	ADDCHILD: "ADDCHILD"
	},

	isContainer: true,


	templateString: ('<div class="dojoTreeNode"> '
		+ '<span treeNode="${this.widgetId}" class="dojoTreeNodeLabel" dojoAttachPoint="labelNode"> '
		+ '		<span dojoAttachPoint="titleNode" dojoAttachEvent="onClick: onTitleClick" class="dojoTreeNodeLabelTitle">${this.title}</span> '
		+ '</span> '
		+ '<span class="dojoTreeNodeAfterLabel" dojoAttachPoint="afterLabelNode">${this.afterLabel}</span> '
		+ '<div dojoAttachPoint="containerNode" style="display:none"></div> '
		+ '</div>').replace(/(>|<)\s+/g, '$1'), // strip whitespaces between nodes


	childIconSrc: "",
	childIconFolderSrc: dojo.uri.dojoUri("src/widget/templates/images/Tree/closed.gif"), // for under root parent item child icon,
	childIconDocumentSrc: dojo.uri.dojoUri("src/widget/templates/images/Tree/document.gif"), // for under root parent item child icon,

	childIcon: null,
	isTreeNode: true,

	objectId: "", // the widget represents an object

	afterLabel: "",
	afterLabelNode: null, // node to the left of labelNode

	// an icon left from childIcon: imgs[-2].
	// if +/- for folders, blank for leaves
	expandIcon: null,

	title: "",
	object: "", // node may have object attached, settable from HTML
	isFolder: false,

	labelNode: null, // the item label
	titleNode: null, // the item title
	imgs: null, // an array of icons imgs


	tree: null,

	depth: 0,

	isExpanded: false,

	state: null,  // after creation will change to loadStates: "loaded/loading/unchecked"
	domNodeInitialized: false,  // domnode is initialized with icons etc


	isFirstNode: function() {
		return this.getPreviousSibling() ? false : true;
	},

	isLastNode: function() {
		return this.getNextSibling() ? false : true;
	},

	actionIsDisabled: function(action) {
		var _this = this;

		return (action == this.actions.ADDCHILD && !this.isFolder) || dojo.lang.inArray(_this.actionsDisabled, action);
	},

	getInfo: function() {
		// No title here (title may be widget)
		var info = {
			widgetId: this.widgetId,
			objectId: this.objectId,
			index: this.getParentIndex(),
			isFolder: this.isFolder
		}

		return info;
	},

	initialize: function(args, frag){

		//dojo.debug(this.title)

		this.state = this.loadStates.UNCHECKED;

		for(var i=0; i<this.actionsDisabled.length; i++) {
			this.actionsDisabled[i] = this.actionsDisabled[i].toUpperCase();
		}

	},


	/**
	 * Change visible node depth by appending/prepending with blankImgs
	 * @param depthDiff Integer positive => move right, negative => move left
	*/
	adjustDepth: function(depthDiff) {

		for(var i=0; i<this.children.length; i++) {
			this.children[i].adjustDepth(depthDiff);
		}

		this.depth += depthDiff;

		if (depthDiff>0) {
			for(var i=0; i<depthDiff; i++) {
				var img = this.tree.makeBlankImg();
				this.imgs.unshift(img);
				//dojo.debugShallow(this.domNode);
				this.domNode.insertBefore(this.imgs[0], this.domNode.firstChild);

			}
		}
		if (depthDiff<0) {
			for(var i=0; i<-depthDiff;i++) {
				this.imgs.shift();
				this.domNode.removeChild(this.domNode.firstChild);
			}
		}

	},


	markLoading: function() {
		this.expandIcon.src = this.tree.expandIconSrcLoading;
	},


	setFolder: function() {
		dojo.event.connect(this.expandIcon, 'onclick', this, 'onTreeClick');
		this.expandIcon.src = this.isExpanded ? this.tree.expandIconSrcMinus : this.tree.expandIconSrcPlus;
		this.isFolder = true;
	},


	createDOMNode: function(tree, depth){

		this.tree = tree;
		this.depth = depth;


		//
		// add the tree icons
		//

		this.imgs = [];

		for(var i=0; i<this.depth+1; i++){

			var img = this.tree.makeBlankImg();

			this.domNode.insertBefore(img, this.labelNode);

			this.imgs.push(img);
		}


		this.expandIcon = this.imgs[this.imgs.length-1];


		this.childIcon = this.tree.makeBlankImg();

		// add to images before the title
		this.imgs.push(this.childIcon);

		dojo.dom.insertBefore(this.childIcon, this.titleNode);

		// node with children(from source html) becomes folder on build stage.
		if (this.children.length || this.isFolder) {
			this.setFolder();
		}

		dojo.event.connect(this.childIcon, 'onclick', this, 'onIconClick');


		//
		// create the child rows
		//


		for(var i=0; i<this.children.length; i++){
			this.children[i].parent = this;

			var node = this.children[i].createDOMNode(this.tree, this.depth+1);

			this.containerNode.appendChild(node);
		}


		if (this.children.length) {
			this.state = this.loadStates.LOADED;
		}

		this.updateIcons();

		this.domNodeInitialized = true;

		dojo.event.topic.publish(this.tree.eventNames.createDOMNode, { source: this } );

		return this.domNode;
	},

	onTreeClick: function(e){
		dojo.event.topic.publish(this.tree.eventNames.treeClick, { source: this, event: e });
	},

	onIconClick: function(e){
		dojo.event.topic.publish(this.tree.eventNames.iconClick, { source: this, event: e });
	},

	onTitleClick: function(e){
		dojo.event.topic.publish(this.tree.eventNames.titleClick, { source: this, event: e });
	},

	markSelected: function() {
		dojo.html.addClass(this.titleNode, 'dojoTreeNodeLabelSelected');
	},


	unMarkSelected: function() {
		//dojo.debug('unmark')
		dojo.html.removeClass(this.titleNode, 'dojoTreeNodeLabelSelected');
	},

	updateExpandIcon: function() {
		if (this.isFolder){
			this.expandIcon.src = this.isExpanded ? this.tree.expandIconSrcMinus : this.tree.expandIconSrcPlus;
		} else {
			this.expandIcon.src = this.tree.blankIconSrc;
		}
	},

	/* et the grid under the expand icon */
	updateExpandGrid: function() {

		if (this.tree.showGrid){
			if (this.depth){
				this.setGridImage(-2, this.isLastNode() ? this.tree.gridIconSrcL : this.tree.gridIconSrcT);
			}else{
				if (this.isFirstNode()){
					this.setGridImage(-2, this.isLastNode() ? this.tree.gridIconSrcX : this.tree.gridIconSrcY);
				}else{
					this.setGridImage(-2, this.isLastNode() ? this.tree.gridIconSrcL : this.tree.gridIconSrcT);
				}
			}
		}else{
			this.setGridImage(-2, this.tree.blankIconSrc);
		}

	},

	/* set the grid under the child icon */
	updateChildGrid: function() {

		if ((this.depth || this.tree.showRootGrid) && this.tree.showGrid){
			this.setGridImage(-1, (this.children.length && this.isExpanded) ? this.tree.gridIconSrcP : this.tree.gridIconSrcC);
		}else{
			if (this.tree.showGrid && !this.tree.showRootGrid){
				this.setGridImage(-1, (this.children.length && this.isExpanded) ? this.tree.gridIconSrcZ : this.tree.blankIconSrc);
			}else{
				this.setGridImage(-1, this.tree.blankIconSrc);
			}
		}


	},

	updateParentGrid: function() {
		var parent = this.parent;

		//dojo.debug("updateParentGrid "+this);

		for(var i=0; i<this.depth; i++){

			//dojo.debug("Parent "+parent);

			var idx = this.imgs.length-(3+i);
			var img = (this.tree.showGrid && !parent.isLastNode()) ? this.tree.gridIconSrcV : this.tree.blankIconSrc;

			//dojo.debug("Image "+img+" for "+idx);

			this.setGridImage(idx, img);

			parent = parent.parent;
		}
	},

	updateExpandGridColumn: function() {
		if (!this.tree.showGrid) return;

		var _this = this;

		var icon = this.isLastNode() ? this.tree.blankIconSrc : this.tree.gridIconSrcV;

		dojo.lang.forEach(_this.getDescendants(),
			function(node) { node.setGridImage(_this.depth, icon); }
		);

		this.updateExpandGrid();
	},

	updateIcons: function(){


		//dojo.profile.start("updateIcons")

		//dojo.debug("Update icons for "+this)
		//dojo.debug(this.isFolder)

		this.imgs[0].style.display = this.tree.showRootGrid ? 'inline' : 'none';


		//
		// set the expand icon
		//


		//
		// set the child icon
		//
		this.buildChildIcon();

		this.updateExpandGrid();
		this.updateChildGrid();
		this.updateParentGrid();



		dojo.profile.stop("updateIcons")

	},

	buildChildIcon: function() {
		this.childIcon.src = this.childIconSrc ? this.childIconSrc : "url()";
		this.childIcon.style.display = this.childIconSrc ? 'inline' : 'none';
	},

	setGridImage: function(idx, src){

		if (idx < 0){
			idx = this.imgs.length + idx;
		}

		//if (idx >= this.imgs.length-2) return;
		this.imgs[idx].style.backgroundImage = 'url(' + src + ')';
	},


	updateIconTree: function(){
		this.tree.updateIconTree.call(this);
	},




	expand: function(){
		if (this.isExpanded) return;

		if (this.children.length) {
			this.showChildren();
		}

		this.isExpanded = true;

		this.updateExpandIcon();

		dojo.event.topic.publish(this.tree.eventNames.expand, {source: this} );
	},

	collapse: function(){
		if (!this.isExpanded) return;

		this.hideChildren();
		this.isExpanded = false;

		this.updateExpandIcon();

		dojo.event.topic.publish(this.tree.eventNames.collapse, {source: this} );
	},

	hideChildren: function(){
		var _this = this;
		this.tree.toggleObj.hide(
			_this.containerNode, _this.toggleDuration, _this.explodeSrc, _this.onHide
		);

		/* if dnd is in action, recalculate changed coordinates */
		if(dojo.exists(dojo, 'dnd.dragManager.dragObjects') && dojo.dnd.dragManager.dragObjects.length) {
			dojo.dnd.dragManager.cacheTargetLocations();
		}
	},

	showChildren: function(){
		var _this = this;
		this.tree.toggleObj.show(
			_this.containerNode, _this.toggleDuration,	_this.explodeSrc, _this.onShow
		);

		/* if dnd is in action, recalculate changed coordinates */
		if(dojo.exists(dojo, 'dnd.dragManager.dragObjects') && dojo.dnd.dragManager.dragObjects.length) {
			dojo.dnd.dragManager.cacheTargetLocations();
		}
	},

	/* clean my domNodes before destruction */
	cleanUp: function() {
		try{
			dojo.event.browser.clean(this.domNode);
			delete this.domNode;
		}catch(e){ }
	},

	addChild: function(){
		return this.tree.addChild.apply(this, arguments);
	},

	doAddChild: function(){
		return this.tree.doAddChild.apply(this, arguments);
	},



	/* Edit current node : change properties and update contents */
	edit: function(props) {
		dojo.lang.mixin(this, props);
		if (props.title) {
			this.titleNode.innerHTML = this.title;
		}

		if (props.afterLabel) {
			this.afterLabelNode.innerHTML = this.afterLabel;
		}

		if (props.childIconSrc) {
			this.buildChildIcon();
		}


	},


	removeChild: function(){ return this.tree.removeChild.apply(this, arguments) },
	destroyChild: function(){ return this.tree.destroyChild.apply(this, arguments) },
	doRemoveChild: function(){ return this.tree.doRemoveChild.apply(this, arguments) },


	toString: function() {
		return "["+this.widgetType+" Tree:"+this.tree+" ID:"+this.widgetId+" Title:"+this.title+"]";

	}

});




