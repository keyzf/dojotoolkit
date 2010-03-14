dojo.provide("dojox.xmpp.transportProviders._base.SocketTransportProvider");

dojo.require("dojox.xmpp.transportProviders._base.Provider");
dojo.require("dojox.xmpp.SaxStreamReader");

dojo.declare("dojox.xmpp.transportProviders._base.SocketTransportProvider", [dojox.xmpp.transportProviders._base.Provider], {
    _streamReader: null,
    
    constructor: function(config) {
		this._streamReader = new dojox.xmpp.SaxStreamReader();
        dojo.connect(this._streamReader, "onSessionStart", this, "onStreamReady");
        dojo.connect(this._streamReader, "onSessionEnd", this, "close");
        dojo.connect(this._streamReader, "onStanza", this, "stanzaHandler");
    },
    
    open: function() {
        console.log("Connecting to: domain =" + this.domain + ", server =" + this.server + ", port =" + this.port);
        // To be overridden with code that opens the connection using socket APIs
    },
    
    restartStream: function() {
		this.inherited(arguments);
        try {
            this._streamReader.reset();
            this._writeToSocket("<?xml version=\"1.0\"?>");
            this._writeToSocket(dojox.xmpp.util.createElement("stream:stream", {
                to: this.domain,
                "xml:lang": this.lang,
                xmlns: dojox.xmpp.ns.CLIENT_NS,
                "xmlns:stream": dojox.xmpp.ns.STREAM_NS,
                version: "1.0"
            }, false));
        } catch(e) {
            console.error('dojox.xmpp.transportProviders._base.SocketTransportProvider :: restartStream :: ',e);
        }
    },
    
    close: function(/*String*/reason, /*Boolean*/isError) {
		this.inherited(arguments);
		console.debug("Closing Titanium transport socket.");
    },
    
    _writeToSocket: function(data) {
        data = data.toString();
		if(data === " ") {
            console.info("SEND: keep-alive");
		} else {
            console.info("SEND: " + data);
		}
		// To be inherited from to write to the socket
    },
    
    dispatchPacket: function(msg, protocolMatchType, matchId, matchProperty) {
		var def = this.inherited(arguments);
        this._writeToSocket(msg.toString());
		return def;
    }
});