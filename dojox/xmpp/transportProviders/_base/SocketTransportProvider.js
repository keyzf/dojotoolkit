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
            console.log(e);
            console.log("Automatic retry after a second");
            setTimeout(dojo.hitch(this, this.restartStream), 1000);
        }
    },
    
    close: function(reason) {
		this.inherited(arguments);
        console.log("Closing Titanium transport socket.");
        if(reason) {
            this._writeToSocket(dojox.xmpp.util.createElement("presence",{type:reason,xmlns:dojox.xmpp.xmpp.CLIENT_NS},true));
        }
		// To be inherited from, to close the socket
    },
    
    _writeToSocket: function(data) {
        data = data.toString();
        console.info("SEND: " + data);
		// To be inherited from to write to the socket
    },
    
    dispatchPacket: function(msg, protocolMatchType, matchId, matchProperty) {
		var def = this.inherited(arguments);
        this._writeToSocket(msg.toString());
		return def;
    }
});