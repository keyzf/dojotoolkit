dojo.provide("dojox.xmpp.transportProviders._base.BoshTransportProvider");

dojo.require("dojox.xmpp.transportProviders._base.Provider");

dojo.declare("dojox.xmpp.transportProviders._base.BoshTransportProvider", dojox.xmpp.transportProviders._base.Provider, {
	_rid: 0,
	_hold: 1,
	_polling:1000,
	_secure: false,
	_wait: 60,
	_lang: 'en',
	_submitContentType: 'text/xml; charset=utf=8',
	_serviceUrl: '/httpbind',
	_defaultResource: "dojoIm",
	_domain: 'imserver.com',
	_sendTimeout: 0, //(this.wait+20)*1000
	
	keepAliveTimer: 10000,
	
	_transmitState: "Idle",
	
	_protocolPacketQueue: [],
	_outboundQueue: [],
	_outboundRequests: {},
	_inboundQueue: [],
	
	constructor: function() {},
	
	open: function() {
		this._rid = Math.round(Math.random() * 1000000000);
		this._protocolPacketQueue = [];
		this._outboundQueue = [];
		this._outboundRequests = {};
		this._inboundQueue = [];
		this._resetKeepalive();
	},
	
	restartStream: function() {
		this.inherited(arguments);

        var rid = this._rid++;
        var msg = dojox.xmpp.util.createElement("body", {
            rid: rid,
            sid: this._sid,
            to: this._domain,
            "xmpp:restart": "true",
            "xml:lang": this._lang,
            xmlns: dojox.xmpp.ns.BODY_NS,
            "xmlns:xmpp": "urn:xmpp:xbosh"
        }, true);
        this._addToOutboundQueue(msg, rid);
	},
	
	_sendLogin: function(){
		var rid = this._rid++;
		
		var msg = dojox.xmpp.util.createElement("body", {
            content: this._submitContentType,
            hold: this._hold,
            rid: rid,
            to: this.domain,
            secure: this._secure,
            wait: this._wait,
            "xml:lang": this._lang,
            "xmpp:version": "1.0",
            xmlns: dojox.xmpp.ns.BODY_NS,
            "xmlns:xmpp": "urn:xmpp:xbosh"
        }, true);
		this._addToOutboundQueue(msg, rid);
	},
	
	processScriptSrc: function(msg, rid){
		var msgDom = dojox.xml.parser.parse(msg, "text/xml");
		if (msgDom) {
			this._processDocument(msgDom, rid);
		}
	},
	
	close: function(reason){
		this.inherited(arguments);
		var rid = this._rid++;
		var req = {
			sid: this._sid,
			rid: rid,
			type: "terminate"
		};
		var envelope = null;
		
		if(reason) {
			envelope = new dojox.string.Builder(dojox.xmpp.util.createElement("body", req, false));
			envelope.append(dojox.xmpp.util.createElement("presence",{type:reason,xmlns:dojox.xmpp.ns.CLIENT_NS},true));
			envelope.append("</body>");
		} else {
			envelope = new dojox.string.Builder(dojox.xmpp.util.createElement("body", req, false));
		}
		
		this._addToOutboundQueue(envelope.toString(), rid);
		this.state == "Terminate";
	},
	
	dispatchPacket: function(msg) {
		if(msg) {
			if(msg === " ") {
				this._dispatchPacket();
				return;
			}
			this._protocolPacketQueue.push(msg);
		}
		var def = this.inherited(arguments);
		if(!this._dispatchTimer) {
			this._dispatchTimer = setTimeout(dojo.hitch(this, "_dispatchPacket"), 600);
		}
		return def;
	},
	
	_dispatchPacket: function(){
		clearTimeout(this._dispatchTimer);
		delete this._dispatchTimer;
		
		if (!this._sid) {
			console.debug("TransportSession::dispatchPacket() No SID, packet dropped.")
			return;
		}
		
		if (!this._authId) {
			//FIXME according to original nodes, this should wait a little while and try
			//      again up to three times to see if we get this data.
			console.debug("TransportSession::dispatchPacket() No authId, packet dropped [FIXME]")
			return;
		}
		
		//if there is a pending request with the server, don't poll
		if (this._transmitState != "error" && (this._protocolPacketQueue.length == 0) && (this._outboundQueue.length > 0)) {
			return;
		}
		
		if (this.state == "wait" || this._isTerminated()) {
			return;
		}
		
		var req = {
			sid: this._sid,
			xmlns: dojox.xmpp.ns.BODY_NS
		};
		
		var envelope;
		if (this._protocolPacketQueue.length > 0) {
			req.rid = this._rid++;
			envelope = new dojox.string.Builder(dojox.xmpp.util.createElement("body", req, false));
			envelope.append(this._processProtocolPacketQueue());
			envelope.append("</body>");
			delete this._lastPollTime;
		} else {
			if (this._lastPollTime) {
				var now = new Date().getTime();
				if (now - this._lastPollTime < this._polling) {
					this._dispatchTimer = setTimeout(dojo.hitch(this, "_dispatchPacket"), this._polling - (now - this._lastPollTime) + 10);
					return;
				}
				
			}
			req.rid = this._rid++;
			this._lastPollTime = new Date().getTime();
			envelope = new dojox.string.Builder(dojox.xmpp.util.createElement("body", req, true));
		}
		
		
		this._addToOutboundQueue(envelope.toString(), req.rid);
		
	},
	
	_addToOutboundQueue: function(msg, rid){
		this._outboundQueue.push({
			msg: msg,
			rid: rid
		});
		this._outboundRequests[rid] = msg;
		this._sendXml(msg, rid);
	},
	
	_removeFromOutboundQueue: function(rid){
		for (var i = 0; i < this._outboundQueue.length; i++) {
			if (rid == this._outboundQueue[i].rid) {
				this._outboundQueue.splice(i, 1);
				break;
			}
		}
		delete this._outboundRequests[rid];
	},
	
	_processProtocolPacketQueue: function(){
		var packets = new dojox.string.Builder();
		packets.append.apply(this, this._protocolPacketQueue);
		this._protocolPacketQueue = [];
		return packets.toString();
	},
	
	_sendXml: function(message, rid) {
        this._transmitState = "transmitting";
		console.info("SEND: " + message);
	},
	
	_isTerminated: function() {
		return this.state=="Terminate";
	},
	
	_processDocument: function(doc, rid){
		if (this._isTerminated() || !doc.firstChild) {
			return false;
		}
		
		this._transmitState = "idle";
		
		var body = doc.firstChild;
		
		if (this._outboundQueue.length < 1) {
			return false;
		}
		
		var expectedId = this._outboundQueue[0].rid;
		
		if (rid == expectedId) {
			this._removeFromOutboundQueue(rid);
			this._processResponse(body, rid);
			this._processInboundQueue();
		} else {
			var gap = rid - expectedId;
			
			if (gap < this.hold + 2) {
				this._addToInboundQueue(doc, rid);
			}
		}
		return doc;
	},
	
	_processInboundQueue: function(){
		while (this._inboundQueue.length > 0) {
			var item = this._inboundQueue.shift();
			this._processDocument(item.doc, item.rid);
		}
	},
	
	_addToInboundQueue: function(doc, rid){
		for (var i = 0; i < this._inboundQueue.length; i++) {
			if (rid < this._inboundQueue[i].rid) {
				continue;
			}
			this._inboundQueue.splice(i, 0, {
				doc: doc,
				rid: rid
			});
		}
	},
	
	_processResponse: function(body, rid){
		if (body.getAttribute("type") == 'terminate') {
			var reasonNode = body.firstChild.firstChild;
			var errorMessage = "";
			if (reasonNode.nodeName == "conflict") {
				errorMessage = "conflict"
			}
			this.setState("Terminate", errorMessage);
			
			return;
		}
		
		if ((this.state != 'Ready') && (this.state != 'Terminate')) {
			var sid = body.getAttribute("sid");
			if (sid) {
				this._sid = sid;
			} else {
				throw new Error("No sid returned during xmpp session startup");
			}
			
			this._authId = body.getAttribute("authid");
			if (this._authId == "") {
				if (this._authRetries-- < 1) {
					console.error("Unable to obtain Authorization ID");
					this._terminateSession();
				}
			}
			this._wait = body.getAttribute("wait");
			if (body.getAttribute("polling")) {
				this.polling = parseInt(body.getAttribute("polling")) * 1000;
			}
			
			//console.log("Polling value ", this.polling);
			this.inactivity = body.getAttribute("inactivity");
			this.setState("Ready");
		}
		
		dojo.forEach(body.childNodes, function(node){
			this.stanzaHandler(node, rid);
		}, this);
		
		if (this._transmitState == "idle") {
			this.dispatchPacket();
		}
	},
	
	_isTerminated: function(){
		return this.state == "Terminate";
	},
	
	_processError: function(err, httpStatusCode, rid){
		//console.log("Processing server error ", err, httpStatusCode,rid);
		if (this._isTerminated()) {
			return false;
		}
		
		
		if (httpStatusCode != 200) {
			if (httpStatusCode >= 400 && httpStatusCode < 500) {
				/* Any status code between 400 and 500 should terminate
    			 * the connection */
				this.setState("Terminate", errorMessage);
				return false;
			} else {
				this.removeFromOutboundQueue(rid);
				setTimeout(dojo.hitch(this, function(){
					this._dispatchPacket();
				}), 200);
				return true;
			}
			return false;
		}
		
		this._removeFromOutboundQueue(rid);
		
		//FIXME conditional processing if request will be needed based on type of error.
		if (err && err.firstChild) {
			if (err.firstChild.getAttribute("type") == 'terminate') {
				var reasonNode = err.firstChild.firstChild;
				var errorMessage = "";
				if (reasonNode && reasonNode.nodeName == "conflict") {
					errorMessage = "conflict"
				}
				this.setState("Terminate", errorMessage);
				return false;
			}
		}
		this._transmitState = "error";
		setTimeout(dojo.hitch(this, function(){
			this._dispatchPacket();
		}), 200);
		//console.log("Error: ", arguments);
		return true;
	}
});