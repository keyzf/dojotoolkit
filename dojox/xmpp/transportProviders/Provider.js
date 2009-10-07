dojo.provide("dojox.xmpp.transportProviders.Provider");

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

dojo.declare("dojox.xmpp.transportProviders.Provider", null, {
	open: function() {
		// Opens a connection to the server.
		console.warn("dojox.xmpp.transportProviders.<selected transport provider>.open not implemented.");
	},
	
	close: function(reason) {
		// Closes the connection
		console.warn("dojox.xmpp.transportProviders.<selected transport provider>.close not implemented.");
	},
	
	setState: function() {
		//Set's the current connection state
		console.warn("dojox.xmpp.transportProviders.<selected transport provider>.setState not implemented.");
	},
	
	restartStream: function() {
		// Restart a stream
		console.warn("dojox.xmpp.transportProviders.<selected transport provider>.restartStream not implemented.");
	},
	
	dispatchPacket: function(msg, protocolMatchType, matchId, matchProperty) {
		console.warn("dojox.xmpp.transportProviders.<selected transport provider>.dispatchPacket not implemented.");
	},
	
	constructor: function(config) {
        // The following 3 lines really belong in dojox.xmpp.transportProviders.Provider
        dojo.mixin(this, config);
        this.server = config.server || config.domain;
        this.port = parseInt(config.port, 10) || 5222;
	},
	
	onStreamReady: function() {
		// Event signalling that the stream is ready to interact with
	},
	
	onProcessProtocolResponse: function(msg) {
        
	}
});