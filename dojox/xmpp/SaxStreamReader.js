dojo.provide("dojox.xmpp.SaxStreamReader");

dojo.require("dojox.xml.SaxParser");
dojo.require("dojox.string.Builder");

dojo.declare("dojox.xmpp.SaxStreamReader", null, {
    _saxParser: null,
    _saxBuffer: null,
    _saxDepth: 0,
    
	// Events raised here:
	onSessionStart: function() {},
	onSessionEnd: function() {},
	onStanza: function(stanzaNode) {},
	
    constructor: function() {
        this.reset();
    },
	
    _startElementHandler: function(nodeName, attributes) {
        this._saxDepth++;
        if (this._saxDepth > 1) {
			this._saxBuffer.append("<", nodeName, " ", attributes, ">");
		} else if (this._saxDepth == 1) {
			console.info("RECD: <" + nodeName + attributes + ">");
			this.onSessionStart();
		}
	},
	
    _charactersHandler: function(chars) {
        if(this._saxDepth > 1) {
			this._saxBuffer.append(chars);
		}
    },
	
    _endElementHandler: function(nodeName) {
		try {
			this._saxBuffer.append("</", nodeName, ">");
			this._saxDepth--;
			if (this._saxDepth == 1) {
				var serializedXml = this._saxBuffer.toString();
				this._saxBuffer.clear();
				console.info("RECD: ", serializedXml);
				this.onStanza(dojox.xml.parser.parse(serializedXml).documentElement);
			}
			else 
				if (this._saxDepth == 0) {
					console.info("RECD: </" + nodeName + ">");
					this._saxBuffer.clear();
					this._saxDepth = 0;
					this.onSessionEnd();
				}
		}catch(e) { alert(e);}
	},
	
	_startElementConnectHandle: null,
	_endElementConnectHandle: null,
	_charactersConnectHandle: null,
	
	reset: function() {
		if(this._saxParser) {
			dojo.disconnect(this._startElementConnectHandle);
			dojo.disconnect(this._endElementConnectHandle);
			dojo.disconnect(this._charactersConnectHandle);
		}
		
        this._saxParser = new dojox.xml.SaxParser(true);
        this._saxBuffer = this._saxBuffer?this._saxBuffer.clear():new dojox.string.Builder(true);
		this._saxDepth = 0;
		
        this._startElementConnectHandle = dojo.connect(this._saxParser, "onStartElement", this, "_startElementHandler");
        this._endElementConnectHandle = dojo.connect(this._saxParser, "onEndElement", this, "_endElementHandler");
        this._charactersConnectHandle = dojo.connect(this._saxParser, "onCdataCharacters", this, "_charactersHandler");
	},
	
	parse: function(data) {
		this._saxParser.parse(data);
	}
});
