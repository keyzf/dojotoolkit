dojo.provide("dojox.xmpp.SaxToJson");

dojo.require("dojox.xml.SaxParser");
dojo.require("dojox.string.Builder");

dojo.declare("dojox.xmpp.SaxToJson", [], {
    // summary:
    //      A SAX stream reader for xmpp stream which reads the stream form
    //      SAX parser and converts the xmpp stanzas (level 1 packets) to json

    // Events raised to be consumed by users
    onSessionStart: function() {},
    onSessionEnd: function() {},
    onStanza: function(stanzaNode) {},

    constructor: function() {
        // summary:
        //      Initialise the SAX parser

        this._saxParser = new dojox.xml.SaxParser(true);
        this._saxDepth = 0;
        this._nodeStack = new Array();
        this._cDataStack = new Array();

        this._attachHandlers();
    },

    _attachHandlers: function(){
        // summary:
        //      Attach handlers for events raised by SAX stream reader

        // Detach old handlers
        if(this._startElementConnectHandle) dojo.disconnect(this._startElementConnectHandle);
        if(this._endElementConnectHandle) dojo.disconnect(this._endElementConnectHandle);
        if(this._charactersConnectHandle) dojo.disconnect(this._charactersConnectHandle);

        // Attach handlers
        this._startElementConnectHandle = dojo.connect(this._saxParser, "onStartElement", this, "_startElementHandler");
        this._endElementConnectHandle = dojo.connect(this._saxParser, "onEndElement", this, "_endElementHandler");
        this._charactersConnectHandle = dojo.connect(this._saxParser, "onCdataCharacters", this, "_charactersHandler");
    },

    _startElementHandler: function(/*String*/ nodeName, /*String*/ attributes){
        // summary:
        //      Fired at the start of the xml element in the
        //      xmpp stream

        this._saxDepth++;
        var jsonData = this._attrToJson(nodeName, attributes);
        this._nodeStack.push(jsonData);
        var cData = new dojox.string.Builder();
        this._cDataStack.push(cData);
    },

    _charactersHandler: function(/*String*/ chars){
        // sunmary:
        //      Raised when text for an xml element received

        // Instead of pop-push, modify Array[length-1] element
        var len = this._cDataStack.length;
        if(len == 0){
            console.error("Incorrect SAX stream, stray character data received");
        }
        else{
            this._cDataStack[len-1].append(chars);
        }
    },

    _endElementHandler: function(/*String*/ nodeName){
        // summary:
        //      Fired at the end of the xml element in the
        //      xmpp stream

        this._saxDepth--;
        var node = this._nodeStack.pop();
        var text = this._cDataStack.pop().toString();
        node["#text"] = text;

        if(!node[nodeName]){
            console.log("SAX stream out of order");
            console.log(nodeName + " element should not have ended here");
        }

        if (this._saxDepth == 1){
            if(nodeName != "vCard"){
                console.warn(node)
            }
            this.onStanza(node);
        }
        else{
            if (this._saxDepth == 0){
                this.onSessionEnd();
            }
        }
    },

    _attrToJson: function(/*String*/ nodeName, /*String*/ attrList){
        // summary:
        //      Convert the attributes list from SAX parser into a JSON

        attrList = attrList.split(/ /);
        var jsonData = {};
        jsonData[nodeName] = {};
        var attrData = jsonData[nodeName];

        for(var i=0; i<attrList.length; i++){
            var attr = attrList[i];

            // Use a compiled regex instead
            var match = attr.match(/[\s]*([\S]+)[\s]*=[\s]*\"([\s\S]*)\"[\s]*/);
            if(match){
                attrData["@" + match[1]] = match[2];
            }
            else{
                match = attr.match(/[\s]*([\S]+)[\s]*=[\s]*\'([\s\S]*)\'[\s]*/);
                if (match) {
                  attrData["@" + match[1]] = match[2];
                }
            }
        }
        return jsonData;
    },

    parse: function(data) {
        // summary:
        //      Route the stream data received to SAX parser

        this._saxParser.parse(data);
    }
});
