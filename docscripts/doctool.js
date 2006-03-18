dojo.require("dojo.widget.html.ComboBox");
dojo.require("dojo.doc");
dojo.require("dojo.widget.DocPane");

var docCount = 0;
var docKeys = [];

//dojo.doc.getMeta(++docCount, _result, "dojo.animation.Animation.play");
//docKeys[docCount] = "meta";
//dojo.doc.getSrc(++docCount, _result, "dojo.animation.Animation");
//docKeys[docCount] = "src";
//dojo.doc.getDoc(++docCount, _result, "dojo.animation.Animation.play");
//docKeys[docCount] = "doc";
//dojo.event.topic.publish("docSelectFunction", {selectKey: ++docCount, name: "dojo.animation.Animation.play"});
//dojo.event.topic.subscribe("docFunctionDetail", _docResult);

function docInit(){
	var search = dojo.widget.byId("search").dataProvider;
	dojo.doc.functionNames(++docCount, docSetData);
	dojo.widget.byId("search").dataProvider.startSearch = function(searchStr){
		this.searchType = "SUBSTRING";
		if("dojo.".match(new RegExp("^" + searchStr))){
			this.searchType = "STARTSTRING";
		}
		this._preformSearch(searchStr);
	}
	dojo.event.connect(dojo.widget.byId("search").textInputNode, "onkeyup", docSearch);
}
dojo.addOnLoad(docInit);

function docSetData(/*String*/ type, /*Array*/ data, /*Object*/ evt){
	var search = dojo.widget.byId("search").dataProvider;
	search.setData.call(search, data);
}

function _result(/*String*/ type, /*mixed*/ data, /*Object*/ evt){
	if(docKeys[evt.selectKey] == "meta"){
		dojo.debug(type + " meta: " + dojo.json.serialize(data));
	}else if(docKeys[evt.selectKey] == "src"){
		dojo.debug(type + " src: " + data);
	}else if(docKeys[evt.selectKey] == "doc"){
		dojo.debug(type + " doc: " + dojo.json.serialize(data));
	}
	delete docKeys[evt.selectKey];
}

function _docResult(){
	dojo.debug(dojo.json.serialize(arguments));
}

function docSearch(evt){
	if(evt.keyCode == 13){
		dojo.widget.byId("search").hideResultList();
		dojo.event.topic.publish("docSearch", {selectKey: ++docCount, name: dojo.widget.byId("search").textInputNode.value});
	}
}

function docResults(/*Object*/ input){
	dojo.debug(dojo.json.serialize(input));
}

//dojo.event.topic.subscribe("docResults", docResults);
