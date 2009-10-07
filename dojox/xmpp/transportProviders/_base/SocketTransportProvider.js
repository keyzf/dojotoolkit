dojo.provide("dojox.xmpp.transportProviders._base.SocketTransportProvider");

dojo.require("dojox.xmpp.transportProviders.Provider");
dojo.require("dojox.xmpp.SaxStreamReader");

dojo.declare("dojox.xmpp.transportProviders._base.SocketTransportProvider", [dojox.xmpp.transportProviders.Provider], {
    _streamReader: null,
    _matchTypeIdAttribute: [],
    _deferredRequests: {},
    
    constructor: function(config) {
		this._streamReader = new dojox.xmpp.SaxStreamReader();
        dojo.connect(this._streamReader, "onSessionStart", this, "onStreamReady");
        dojo.connect(this._streamReader, "onSessionEnd", this, "close");
        dojo.connect(this._streamReader, "onStanza", this, "processProtocolResponse");
    },
    
    open: function() {
        console.log("Connecting to: domain =" + this.domain + ", server =" + this.server + ", port =" + this.port);
        // To be overridden with code that opens the connection using socket APIs
    },
    
    restartStream: function() {
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
        console.log("Closing Titanium transport socket.");
        clearTimeout(this._keepalive);
        this._keepalive = null;
        if(reason) {
            this._writeToSocket(dojox.xmpp.util.createElement("presence",{type:reason,xmlns:dojox.xmpp.xmpp.CLIENT_NS},true));
        }
        this._matchTypeIdAttribute = [];
        this._deferredRequests = {};
		// To be inherited from, to close the socket
    },
    
    _writeToSocket: function(data) {
        data = data.toString();
        console.info("SEND: " + data);
        this._resetKeepalive();
		// To be inherited from to write to the socket
    },
    
    _resetKeepalive: function() {
        if(this._keepalive) {
            clearTimeout(this._keepalive);
        }
    
        this._keepalive = setTimeout(dojo.hitch(this, function() {
            this._writeToSocket(" ");
        }), 30000);
    },
    
    dispatchPacket: function(msg, protocolMatchType, matchId, matchProperty) {
        this._writeToSocket(msg.toString());
        
        var def = new dojo.Deferred();
        
        if (protocolMatchType && matchId){
            def.protocolMatchType = protocolMatchType;
            def.matchId = matchId;    
            def.matchProperty = matchProperty || "id";    
            if(def.matchProperty != "id") {
                this._matchTypeIdAttribute[protocolMatchType] = def.matchProperty;
            }
        }
        
        this._deferredRequests[def.protocolMatchType + "-" + def.matchId] = def;
        
        return def;    
    },
    
    processProtocolResponse: function(msg){
		this.onProcessProtocolResponse(msg);
		
        var key = msg.nodeName + "-" + msg.getAttribute( "id" );
        var def = this._deferredRequests[key];
        if (def){
            def.callback(msg);
            delete this._deferredRequests[key];
        }
        
        return msg;
    }
});