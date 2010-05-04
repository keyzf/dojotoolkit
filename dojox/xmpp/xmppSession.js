dojo.provide("dojox.xmpp.xmppSession");

//dojo.require("dojox.xmpp.TransportSession");
dojo.require("dojox.xmpp.transportManager");
dojo.require("dojox.xmpp.core.Auth");

dojo.require("dojox.xmpp.RosterService");
dojo.require("dojox.xmpp.PresenceService");
dojo.require("dojox.xmpp.UserService");
dojo.require("dojox.xmpp.ChatService");
dojo.require("dojox.xmpp.MucService");

dojox.xmpp.xmpp = {
	STREAM_NS:  'http://etherx.jabber.org/streams',
	CLIENT_NS: 'jabber:client',
	STANZA_NS: 'urn:ietf:params:xml:ns:xmpp-stanzas',
	BODY_NS: "http://jabber.org/protocol/httpbind",

	LEGACY_DELAYED_DELIVERY_NS: "jabber:x:delay",
	DELAYED_DELIVERY_NS: "urn:xmpp:delay",
	
	XHTML_BODY_NS: "http://www.w3.org/1999/xhtml",
	XHTML_IM_NS: "http://jabber.org/protocol/xhtml-im",

	DISCO_INFO_NS: "http://jabber.org/protocol/disco#info",
	DISCO_ITEMS_NS: "http://jabber.org/protocol/disco#items",

	RSM_NS: "http://jabber.org/protocol/rsm",

	INACTIVE: "Inactive",
	CONNECTED: "Connected",
	ACTIVE: "Active",
	TERMINATE: "Terminate",
	LOGIN_FAILURE: "LoginFailure",

	INVALID_ID: -1,
	NO_ID: 0,

	error:{
		BAD_REQUEST: 'bad-request',
		CONFLICT: 'conflict',
		FEATURE_NOT_IMPLEMENTED: 'feature-not-implemented',
		FORBIDDEN: 'forbidden',
		GONE: 'gone',
		INTERNAL_SERVER_ERROR: 'internal-server-error',
		ITEM_NOT_FOUND: 'item-not-found',
		ID_MALFORMED: 'jid-malformed',
		NOT_ACCEPTABLE: 'not-acceptable',
		NOT_ALLOWED: 'not-allowed',
		NOT_AUTHORIZED: 'not-authorized',
		SERVICE_UNAVAILABLE: 'service-unavailable',
		SUBSCRIPTION_REQUIRED: 'subscription-required',
		UNEXPECTED_REQUEST: 'unexpected-request'
	}
};

dojox.xmpp.xmppSession = function(props){
	this.roster = [];
	this.chatRegister = [];
	this.mucRegister = [];
	this._iqId = Math.round(Math.random() * 1000000000);
	this._registeredPacketHandlers = [];

	//mixin any options that we want to provide to this service
	if (props && dojo.isObject(props)) {
		dojo.mixin(this, props);
	}

	this._transport = dojox.xmpp.transportManager.getNewTransportInstance(props);
    // Session is a horrible name. This is step 1 to rename it.
	this.session = this._transport;
	dojo.connect(this._transport, "onStreamReady", this, "onTransportReady");
	dojo.connect(this._transport, "onTerminate", this, "onTransportTerminate");
	dojo.connect(this._transport, "onXmppStanza", this, "handlePacket");


	
	// Register the packet handlers:
	
    /*this.registerPacketHandler({
		name: "iqSetForRoster",
		//condition: "iq[type='set'] query[xmlns='jabber:iq:roster']",
		condition: function(msg) {
			if(msg.nodeName === "iq" && msg.getAttribute("type") === "set" && msg.getElementsByTagName("query").length && msg.getElementsByTagName("query")[0].getAttribute("xmlns") === "jabber:iq:roster") {
				return true;
			}
			return false;
		},
		handler: dojo.hitch(this, function(msg) {
	        this.rosterSetHandler(msg.getElementsByTagName("query")[0]);
	        this.sendIqResult(msg.getAttribute("id"), msg.getAttribute("from"));
		})
    });*/
	
	this.registerPacketHandler({
		name: "iq",
		//condition: "iq[type='set']:not(query)",
		condition: function(msg) {
			if(msg.nodeName === "iq" && msg.getAttribute("type") === "set" && !msg.getElementsByTagName("query").length) {
				return true;
			}
			return false;
		},
		handler: dojo.hitch(this, function(msg) {
    		this.sendStanzaError('iq', this.domain, msg.getAttribute('id'), 'cancel', 'service-unavailable', 'service not implemented');
		})
    });
	
	/*
	this.registerPacketHandler({
		name: "iq",
		condition: "iq[type='get']",
		handler: dojo.hitch(this, function() {
			this.sendStanzaError('iq', this.domain, msg.getAttribute('from'), 'cancel', 'service-unavailable', 'service not implemented');
		})
	});
	*/
    
    this.registerPacketHandler({
		name: "MucPresence",
		condition: "presence x[xmlns^='http://jabber.org/protocol/muc']",
		handler: dojo.hitch(this, function(msg) {
			var mucInstance = this.getMucInstanceFromJid(msg.getAttribute("from"));
			if(mucInstance){
				mucInstance.handlePresence(msg);
			}
		})
    });
    
    this.registerPacketHandler({
		name: "ChatPresence",
		condition: "presence:not(x[xmlns^='http://jabber.org/protocol/muc'])",
		handler: dojo.hitch(this, "presenceHandler")
	});
    
	this.registerPacketHandler({
		name: "MucMessage",
		condition: "message[type='groupchat'], message x[xmlns^='http://jabber.org/protocol/muc']",
		handler: dojo.hitch(this, function(msg){
			var mucInstance = this.getMucInstanceFromJid(msg.getAttribute("from"));
			// TODO: handle invites
			if(mucInstance){
				mucInstance.handleMessage(msg);
			}
		})
	});
    
	this.registerPacketHandler({
		name: "ChatMessage",
		condition: function(msg) {
			if(msg.nodeName === "message") {
				if(msg.getAttribute("type") === "chat" || msg.getAttribute("type") === "normal" || !msg.getAttribute("type")) {
					return true;
				}
			}
			return false;
		},
		//condition: "message[type='chat'], message:not([type]), message[type='normal']",
		handler: dojo.hitch(this, "chatHandler")
	});
    
	/*
	this.registerPacketHandler({
		name: "SimpleMessage",
		condition: dojo.hitch(this, function(msg) {
			return (msg.nodeName==="message") && (!this.isMucJid(msg.getAttribute("from")) && (msg.getAttribute("type")==="normal"));
		}),
		handler: dojo.hitch(this, "simpleMessageHandler")
	});
	*/
    
    this.registerPacketHandler({
		name: "error",
		condition: function(msg){
			return msg.nodeName === "error";
		},
		handler: dojo.hitch(this, function() {
			this.close();
		})
    });
};


dojo.extend(dojox.xmpp.xmppSession, {
		roster: [],
		chatRegister: [],
		_iqId: 0,
	
		open: function(user, password, resource){
			new dojox.xmpp.core.Auth(this, user, password, resource);
			this._transport.open();
		},

		close: function(){
			this.dispatchPacket(dojox.xmpp.util.createElement("presence",{type:"unavailable",xmlns:dojox.xmpp.xmpp.CLIENT_NS},true));
			this.setState(dojox.xmpp.xmpp.TERMINATE,{
				msg: 'logout',
				error: false
			}); // will fire the onTerminate event
			this._transport.close("logout",false);	
		},

        registerPacketHandler: function(handlerInformation) {
			var newCondition;
			if (dojo.isString(handlerInformation.condition)) {
				newCondition = function(msg){
					// Create the envelope when registering itself, rather than when handling the packet. Much faster.
					var envelope = dojox.xml.parser.parse("<tmpenvelope />").documentElement;
					envelope.appendChild(msg.cloneNode(true));
					return !!(dojo.query(handlerInformation.condition, envelope).length);
				};
			} else {
				newCondition = handlerInformation.condition;
			}
			
			handlerInformation.execCondition = newCondition;
			var newLength = this._registeredPacketHandlers.push(handlerInformation); 
			return --newLength;
        },
		
		unregisterPacketHandler: function(registerHandle) {
			if(registerHandle && this._registeredPacketHandlers[registerHandle]) {
                this._registeredPacketHandlers[registerHandle] = null;
			}
		},

		handlePacket: function(msg){
			//console.log("xmppSession::processProtocolResponse() ", msg, msg.nodeName);
			var matchCount = 0, envelope = dojox.xml.parser.parse("<tmpenvelope />").documentElement;
			envelope.appendChild(msg.cloneNode(true));
			dojo.forEach(this._registeredPacketHandlers, function(handlerInformation){
                if(!handlerInformation) {
					return;
				}
				try {
					if (handlerInformation.execCondition(msg)) {
						matchCount++;
						setTimeout(function(){
							try {
                                handlerInformation.handler(handlerInformation.envelope ? envelope : msg);
							} catch(e) {
								console.error("Error when executing the ", handlerInformation.name, " xmpp packet handler: ", e);
							}
						}, matchCount * 100); // Give some breathing room to the UI
					}
				} catch (e) {
					console.error("Error when executing the ", handlerInformation.name, " xmpp packet condition: ", e);
				}
			});
		},

		//HANDLERS 
        // Not required anymore!

        /*
		messageHandler: function(msg){
			//console.log("xmppSession::messageHandler() ",msg);
			var mucInstance = this.isMucJid(msg.getAttribute("from"));
			if(mucInstance){
				mucInstance.handleMessage(msg);
				return;
			}
			
			switch(msg.getAttribute('type')){
				case "chat":
					this.chatHandler(msg);
					break;
				case "normal":
				default:
					this.simpleMessageHandler(msg);	
			}
			
		},
		
		iqHandler: function(msg){
			//console.log("xmppSession::iqHandler()", msg);
			if (msg.getAttribute('type')=="set"){
				this.iqSetHandler(msg);
				return;
			} else if (msg.getAttribute('type')=='get'){
			//	this.sendStanzaError('iq', this.domain, msg.getAttribute('from'), 'cancel', 'service-unavailable', 'service not implemented');
				return;
			}
		},
		*/

		presenceHandler: function(msg){
			//console.log("xmppSession::presenceHandler()", msg);
			switch(msg.getAttribute('type')){
				case 'subscribe':
					//console.log("PresenceHandler: ", msg.getAttribute('from'));
					this.presenceSubscriptionRequest(msg.getAttribute('from'));
					break;
				case 'subscribed':
				case 'unsubscribed':
					break;
				case 'error':		
					this.processXmppError(msg);
					//console.log("xmppService::presenceHandler() Error");
					break;
				default:
					//this.presenceUpdate(msg);
					break;
			}
		},

		sendRestart: function(){
			this._transport.restartStream();
		},


		//SUB HANDLERS

		chatHandler: function(msg){
			//console.log("xmppSession::chatHandler() ", msg);

			var message = {
				from: msg.getAttribute('from'),
				to: msg.getAttribute('to'),
				xml: (new XMLSerializer()).serializeToString(msg)
			};

			var chatState = null;
				//console.log("chat child node ", msg.childNodes, msg.childNodes.length);
			
			var messageNodeHandlers = {
				thread: function(node) {
					message.chatid = node.firstChild.nodeValue
				},
				body: function(node) {
	                if (!node.getAttribute('xmlns') || (node.getAttribute('xmlns') === "")){
	                    message.body = node.firstChild.nodeValue;
	                }
				},
				subject: function(node) {
                    message.subject = node.firstChild.nodeValue;
				},
				html: function(node) {
	                if (node.getAttribute('xmlns') === dojox.xmpp.xmpp.XHTML_IM_NS){
	                    message.xhtml = node.getElementsByTagName("body")[0];
	                }
				}
			}
			
			dojo.query("> *", msg).forEach(function(node){
				var msgNodeName = node.nodeName;
				if (messageNodeHandlers[msgNodeName]) {
					messageNodeHandlers[msgNodeName](node);
				}
				
				var xmlns = node.getAttribute("xmlns");
				
				if (xmlns === dojox.xmpp.chat.CHAT_STATE_NS) {
					chatState = node.nodeName;
				}
				
				// Legacy delayed delivery messages, XEP-0091
				if (node.nodeName == "x" && xmlns === dojox.xmpp.xmpp.LEGACY_DELAYED_DELIVERY_NS) {
					message.timestamp = dojox.xmpp.util.parseLegacyTimestamp(node.getAttribute("stamp"));
				}
				
				// Standard delayed delivery messages, XEP-0203
				if (node.nodeName == "delay" && xmlns === dojox.xmpp.DELAYED_DELIVERY_NS) {
					message.timestamp = dojo.date.stamp.fromISOString(node.getAttribute("stamp"));
				}
			});
			
			var found = -1, i, l, ci;
			// Removed the following code since it fucks up when there's multiple resources
			/*if(message.chatid){
				console.log("setting ci using message.chatid");
				for(i=0, l=this.chatRegister.length; i< l; i++) {
					ci = this.chatRegister[i];
					////console.log("ci.chatid: ", ci.chatid, message.chatid);
					if(ci && ci.chatid === message.chatid) {
						found = i;
						break;	
					}
				}
				console.log("found set to ", found);
			} else {*/
				var bareJid = dojox.xmpp.util.getBareJid(message.from);
				for(var i=0, l=this.chatRegister.length; i<l; i++) {
					ci = this.chatRegister[i];
					if(ci && ci.uid === bareJid){
						found = i;
					}
				}
			//}
			
			if (found>-1){
				var chat = this.chatRegister[found];
				chat.useChatState = (chatState != null) ? true : false;
				if(chatState){
					chat.setState(chatState);

					if (chat.firstMessage && chatState == dojox.xmpp.chat.ACTIVE_STATE) {
						chat.firstMessage = false;
					}
				}
			}

            if ((!message.body || message.body=="") && !message.xhtml) {return;}
			var chatInstance;
			if (found>-1){
				chatInstance = this.chatRegister[found];
			}else{
				chatInstance= new dojox.xmpp.ChatService(message.from, message.chatid);
				chatInstance.firstMessage = true;
				if(!chatState || chatState !== dojox.xmpp.chat.ACTIVE_STATE){
					chatInstance.useChatState = false;
				}else{
					chatInstance.useChatState = true;
				}
				this.registerChatInstance(chatInstance);
			}
            chatInstance.jid = message.from;
			chatInstance.receiveMessage(message);
		},

		isMucJid: function(jid){
			var domain = dojox.xmpp.util.getDomainFromJid(jid);
			return dojo.some(this.mucRegister, function(mucInstance){
				return (mucInstance.domain === domain);
			});
		},
		
		getMucInstanceFromJid: function(jid){
			var domain = dojox.xmpp.util.getDomainFromJid(jid);
			var found = -1;
			for (var i = 0; i < this.mucRegister.length; ++i) {
				var mucInstance = this.mucRegister[i];
				if (mucInstance.domain === domain) {
					found = i;
					break;
				}
			}
			if (found > -1) {
				return this.mucRegister[found];
			} else {
				return null;
			}
		},

		simpleMessageHandler: function(msg){
			//console.log("xmppSession::simpleMessageHandler() ", msg);
		},

		registerChatInstance: function(chatInstance){
			chatInstance.setSession(this);
			this.chatRegister.push(chatInstance);
			this.onRegisterChatInstance(chatInstance);
		},

		registerMucInstance: function(mucInstance){
			mucInstance.setSession(this);
			this.mucRegister.push(mucInstance);
			this.onRegisterMucInstance(mucInstance);
		},
        /*
		iqSetHandler: function(msg){
			if (msg.hasChildNodes()){
				var fn = msg.firstChild;
				switch(fn.nodeName){
					case 'query':
						if(fn.getAttribute('xmlns') == "jabber:iq:roster"){
							this.rosterSetHandler(fn);
							this.sendIqResult(msg.getAttribute('id'), msg.getAttribute('from'));	
						}
						break;
					default:
					//	this.sendStanzaError('iq', this.domain, msg.getAttribute('id'), 'cancel', 'service-unavailable', 'service not implemented');
						break;
				}
			}
		},
		*/

		sendIqResult: function(iqId, to){
			var req = {
				id: iqId,
				to: to || this.domain,
				type: 'result',
				from: this.jid + "/" + this.resource
			}
			this.dispatchPacket(dojox.xmpp.util.createElement("iq",req,true));
		},

		presenceUpdate: function(msg){
			if(msg.getAttribute('to')){
				var jid = this.getBareJid(msg.getAttribute('to'));
				if(jid != this.jid) {
					//console.log("xmppService::presenceUpdate Update Received with wrong address - ",jid);
					return;
				}
			}

			var fromRes = this.getResourceFromJid(msg.getAttribute('from'));

			var p = {
				from: this.getBareJid(msg.getAttribute('from')),
				resource: fromRes,
				show: dojox.xmpp.presence.STATUS_ONLINE,
				priority: 5,
				hasAvatar: false
			}	

			if(msg.getAttribute('type')=='unavailable'){
				p.show=dojox.xmpp.presence.STATUS_OFFLINE
			}

			for (var i=0; i<msg.childNodes.length;i++){
				var n=msg.childNodes[i];
				if (n.hasChildNodes()){
					switch(n.nodeName){
						case 'status':
						case 'show':
							p[n.nodeName]=n.firstChild.nodeValue;
							break;
						case 'status':
							p.priority=parseInt(n.firstChild.nodeValue);
							break;
						case 'x':
							if(n.firstChild && n.firstChild.firstChild &&  n.firstChild.firstChild.nodeValue != "") { 
								p.avatarHash= n.firstChild.firstChild.nodeValue;
								p.hasAvatar = true;
							}
							break;
					}
				}
			}	

			this.onPresenceUpdate(p);
		},

		retrieveRoster: function(){
			dojo.deprecated("xmppSession::retrieveRoster()", "Use xmppSession::rosterStore instead", "2.0");
			// Call the store fetch here.
		},

		getRosterIndex: function(jid){
			dojo.deprecated("xmppSession::getRosterIndex", "", "2.0");
			if(jid.indexOf('@')==-1){
				jid += '@' + this.domain;
			}
			for (var i=0; i<this.roster.length;i++){
				if(jid == this.roster[i].jid) { return i; }
			}
			return -1;
		},

		getNextIqId: function(){
			return "im_" + this._iqId++;
		},

		presenceSubscriptionRequest: function(msg) {
			this.onSubscriptionRequest(msg);
			/*
			this.onSubscriptionRequest({
				from: msg,
				resource:"",
				show:"",
				status:"",
				priority: 5
			});
			*/
		},

		dispatchPacket: function(msg, type, matchId){
			if (this.state != "Terminate") {
				return this._transport.dispatchPacket(msg,type,matchId);
			}else{
				//console.log("xmppSession::dispatchPacket - Session in Terminate state, dropping packet");
			}
		},

		setState: function(state, message){
			if (this.state != state){
				var oldState = this.state;
				this.state=state;
				if (this["on"+state]){
					this["on"+state](message);
				}	
			}
		},

		search: function(searchString, service, searchAttribute){
			var req={
				id: this.getNextIqId(),
				"xml:lang": this.lang,
				type: 'set',
				from: this.jid + '/' + this.resource,
				to: service
			}
			var request = new dojox.string.Builder(dojox.xmpp.util.createElement("iq",req,false));
			request.append(dojox.xmpp.util.createElement('query',{xmlns:'jabber:iq:search'},false));
			request.append(dojox.xmpp.util.createElement(searchAttribute,{},false));
			request.append(searchString);
			request.append("</").append(searchAttribute).append(">");
			request.append("</query></iq>");

			var def = this.dispatchPacket(request,"iq",req.id);
			def.addCallback(this, "_onSearchResults");
		},

		_onSearchResults: function(msg){
			if ((msg.getAttribute('type')=='result')&&(msg.hasChildNodes())){
				//console.log("xmppSession::_onSearchResults(): ", msg.firstChild);

				//call the search results event with an array of results
				this.onSearchResults([]);
			}
		},

		// EVENTS

		onLogin: function(){ 
			////console.log("xmppSession::onLogin()");
			//this.retrieveRoster();
			this.chatRegister=[];
			this.mucRegister=[];
			this.roster=[];
			this.setState(dojox.xmpp.xmpp.ACTIVE); // For backwards compatibilty. To be removed in 2.0.
		},

		onLoginFailure: function(msg){
			//console.log("xmppSession::onLoginFailure ", msg);
		},

		onSearchResults: function(results){
			//console.log("xmppSession::onSearchResult() ", results);
		},

		onRetrieveRoster: function(msg){
			dojo.deprecated("xmppSession::onRetrieveRoster", "Listen to xmppSession's Notification API events instead", "2.0");
			return msg;	
		},
		
		onRosterUpdated: function() {
			dojo.deprecated("xmppSession::onRosterUpdated", "Listen to xmppSession's Notification API events instead", "2.0")
		},

		onSubscriptionRequest: function(req){},

		onPresenceUpdate: function(p){
			dojo.deprecated("xmppSession::onPresenceUpdate", "Listen to xmppSession's Notification API events instead", "2.0")
		},

		onTransportReady: function(){
			this.setState(dojox.xmpp.xmpp.CONNECTED);
			this.rosterService = new dojox.xmpp.RosterService(this);
			this.presenceService= new dojox.xmpp.PresenceService(this);
			this.userService = new dojox.xmpp.UserService(this);

			////console.log("xmppSession::onTransportReady()");
		},

		onTransportTerminate: function(reason, errorParams){
			if (errorParams.args === dojox.xmpp.consts.HOST_NOT_FOUND) {
				this.setState(dojox.xmpp.xmpp.LOGIN_FAILURE, {
					msg: reason,
					error: errorParams
				});
			}
			else {
				this.setState(dojox.xmpp.xmpp.TERMINATE, {
					msg: reason,
					error: errorParams
				});
			}
		},

		onConnected: function(){
			////console.log("xmppSession::onConnected()");
		},

		onTerminate: function(message){
			
		},

		onActive: function(){
			////console.log("xmppSession::onActive()");
			// this.presenceService.publish({show: dojox.xmpp.presence.STATUS_ONLINE});
		},

		onRegisterChatInstance: function(chatInstance){
			////console.log("xmppSession::onRegisterChatInstance()");
		},

		onSocketError: function(){
			this.setState(dojox.xmpp.xmpp.TERMINATE, message);
		},

		onRegisterMucInstance: function(mucInstance){},

		onRosterAdded: function(ri){},
		onRosterRemoved: function(ri){},
		onRosterChanged: function(ri, previousCopy){},

		//Utilities

		processXmppError: function(msg){
			////console.log("xmppSession::processXmppError() ", msg);
			var err = {
				stanzaType: msg.nodeName,
				id: msg.getAttribute('id')
			}
	
			for (var i=0; i<msg.childNodes.length; i++){
				var n = msg.childNodes[i];
				switch(n.nodeName){
					case 'error':
						err.errorType = n.getAttribute('type');
						for (var x=0; x< n.childNodes.length; x++){
							var cn = n.childNodes[x];
							if ((cn.nodeName=="text") && (cn.getAttribute('xmlns') == dojox.xmpp.xmpp.STANZA_NS) && cn.hasChildNodes()) {	
								err.message = cn.firstChild.nodeValue;
							} else if ((cn.getAttribute('xmlns') == dojox.xmpp.xmpp.STANZA_NS) &&(!cn.hasChildNodes())){
								err.condition = cn.nodeName;
							}
						}
						break;
					default:
						break;
				}
			}	
			return err;
		},

		sendStanzaError: function(stanzaType,to,id,errorType,condition,text){
			////console.log("xmppSession: sendStanzaError() ", arguments);
			var req = {type:'error'};
			if (to) { req.to=to; }	
			if (id) { req.id=id; }	
		
			var request = new dojox.string.Builder(dojox.xmpp.util.createElement(stanzaType,req,false));
			request.append(dojox.xmpp.util.createElement('error',{type:errorType},false));
			request.append(dojox.xmpp.util.createElement('condition',{xmlns:dojox.xmpp.xmpp.STANZA_NS},true));

			if(text){
				var textAttr={
					xmlns: dojox.xmpp.xmpp.STANZA_NS,
					"xml:lang":this.lang
				}
				request.append(dojox.xmpp.util.createElement('text',textAttr,false));
				request.append(text).append("</text>");
			}
			request.append("</error></").append(stanzaType).append(">");

			this.dispatchPacket(request.toString());
		},

		getBareJid: function(jid){
			var i = jid.indexOf('/');
			if (i != -1){
				return jid.substring(0, i);
			}
			return jid;
		},

		getResourceFromJid: function(jid){
			var i = jid.indexOf('/');
			if (i != -1){
				return jid.substring((i + 1), jid.length);
			}
			return "";
		},

		fullJid: function(){
			return this.jid + "/" + this.resource;
		}

});
