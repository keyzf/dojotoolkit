dojo.provide("dojox.xmpp.transportProviders._base.Provider");

dojo.require("dojox.xmpp.util");

dojox.xmpp.ns = {
	STREAM_NS: 'http://etherx.jabber.org/streams',
	CLIENT_NS: 'jabber:client',
	STANZA_NS: 'urn:ietf:params:xml:ns:xmpp-stanzas',
	SASL_NS: 'urn:ietf:params:xml:ns:xmpp-sasl',
	BIND_NS: 'urn:ietf:params:xml:ns:xmpp-bind',
	SESSION_NS: 'urn:ietf:params:xml:ns:xmpp-session',
	BODY_NS: "http://jabber.org/protocol/httpbind",
	
	XHTML_BODY_NS: "http://www.w3.org/1999/xhtml",
	XHTML_IM_NS: "http://jabber.org/protocol/xhtml-im"
};

dojo.declare("dojox.xmpp.transportProviders._base.Provider", null, {
	_keepalive: null,
    _deferredRequests: {},
    _matchTypeIdAttribute: {},
	
	keepaliveTimer: 30000,
	
    constructor: function(config) {
        // The following 3 lines really belong in dojox.xmpp.transportProviders.Provider
        dojo.mixin(this, config);
        this.server = config.server || config.domain;
        this.port = parseInt(config.port, 10) || 5222;
    },
    
    _resetKeepalive: function() {
        if(this._keepalive) {
            clearTimeout(this._keepalive);
        }
    
        this._keepalive = setTimeout(dojo.hitch(this, function() {
            this.dispatchPacket(" ");
        }), this.keepaliveTimer);
    },
    
	open: function() {
		// Opens a connection to the server.
		console.warn("dojox.xmpp.transportProviders.<selected transport provider>.open not implemented.");
	},
	
	close: function(reason, /*String*/callback, /*Boolean*/isError) {
        clearTimeout(this._keepalive);
        this._keepalive = null;
        this._deferredRequests = {};
        this._matchTypeIdAttribute = {};
		this.onTerminate(reason, isError);
//        if(typeof this[callback] == "function"){
//           this[callback](reason);
//      }else{
//         this.onTerminate();
//    }
	},
	
	setState: function(state, message) {
        if (this.state != state) {
            if (this["on"+state]){
                this["on"+state](state, this.state, message);
            }
            this.state=state;
        }
	},
	
	restartStream: function() {
		this._resetKeepalive();
	},
	
	dispatchPacket: function(msg, protocolMatchType, matchId, matchProperty) {
		this._resetKeepalive();
		
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
	
	onStreamReady: function() {
		// Event signalling that the stream is ready to interact with
	},

	stanzaHandler: function(msg) {
		this._resetKeepalive();
		
		this.onXmppStanza(msg);
		var key = msg.nodeName + "-" + msg.getAttribute("id");
		var def = this._deferredRequests[key];
		if (def) {
			def.callback(msg);
			delete this._deferredRequests[key];
		}
        
		return msg;
	}
});