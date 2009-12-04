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
	dojo.connect(this._transport, "onConnectionReset", this, "onConnectionReset");
	dojo.connect(this._transport, "onUnableToCreateConnection", this,"onUnableToCreateConnection");
	
	// Register the packet handlers:
	
    this.registerPacketHandler({
		name: "iq",
		condition: "iq[type='set'] query[xmlns='jabber:iq:roster']",
		handler: dojo.hitch(this, function(msg) {
	        this.rosterSetHandler(dojo.query("iq[type='set' query[xmlns='jabber:iq:roster']", msg)[0]);
	        this.sendIqResult(msg.getAttribute("id"), msg.getAttribute("from"));
		})
    });
	
	this.registerPacketHandler({
		name: "iq",
		condition: "iq[type='set']:not(query)",
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
	        mucInstance.handlePresence(msg);
		})
    });
    
    this.registerPacketHandler({
		name: "ChatPresence",
		condition: "presence:not(x[xmlns='http://jabber.org/protocol/muc'])",
		handler: dojo.hitch(this, "presenceHandler")
	});
    
	this.registerPacketHandler({
		name: "MucMessage",
		condition: "message[type='groupchat'], message x[xmlns^='http://jabber.org/protocol/muc']",
		handler: dojo.hitch(this, function(msg){
			this.getMucInstanceFromJid(msg.getAttribute("from")).handleMessage(msg);
		})
	});
    
	this.registerPacketHandler({
		name: "ChatMessage",
		condition: "message[type='chat'])",
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
			this.state = dojox.xmpp.xmpp.TERMINATE;
			this._transport.close("unavailable");	
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
					this.presenceUpdate(msg);
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
			}

			var chatState = null;
				//console.log("chat child node ", msg.childNodes, msg.childNodes.length);
			for (var i=0; i<msg.childNodes.length; i++){
				var n = msg.childNodes[i];
				console.log(n.nodeName);
				if (n.hasChildNodes()){
					//console.log("chat child node ", n);
					switch(n.nodeName) {
						case 'thread':
							message.chatid = n.firstChild.nodeValue;
							break;
						case 'body':
							if (!n.getAttribute('xmlns') || (n.getAttribute('xmlns')=="")){
								message.body = n.firstChild.nodeValue;
							}
							break;
						case 'subject':
							message.subject = n.firstChild.nodeValue;
						case 'html':
							if (n.getAttribute('xmlns')==dojox.xmpp.xmpp.XHTML_IM_NS){
								message.xhtml = n.getElementsByTagName("body")[0];
							}
							break;
						case 'x':
							break;
						default:
							console.log("xmppSession::chatHandler() Unknown node type: ",n.nodeName);
					}
				}
				if(n.getAttribute && n.getAttribute('xmlns')==dojox.xmpp.chat.CHAT_STATE_NS){
					chatState = n.nodeName;
				}

				// Legacy delayed delivery messages, XEP-0091
				if(n.nodeName=="x" && n.getAttribute('xmlns')==dojox.xmpp.xmpp.LEGACY_DELAYED_DELIVERY_NS){
					message.timestamp = dojox.xmpp.util.parseLegacyTimestamp(n.getAttribute("stamp"));
				}

				// Standard delayed delivery messages, XEP-0203
				if(n.nodeName=="delay" && n.getAttribute('xmlns')==dojox.xmpp.DELAYED_DELIVERY_NS){
					message.timestamp = dojo.date.stamp.fromISOString(n.getAttribute("stamp"));
				}
			}

			var found = -1;
			if (message.chatid){
				for (var i=0; i< this.chatRegister.length; i++){
					var ci = this.chatRegister[i];
					////console.log("ci.chatid: ", ci.chatid, message.chatid);
					if (ci && ci.chatid == message.chatid) {
						found = i;
						break;	
					}
				}
			} else {
				for (var i=0; i< this.chatRegister.length; i++){
					var ci = this.chatRegister[i];
					if(ci){
						if (ci.uid==this.getBareJid(message.from)){
							found = i;
						}
					}
				}
			}	

			if (found>-1){
				var chat = this.chatRegister[found];
				chat.useChatState = (chatState != null) ? true : false;
				if(chatState){
					chat.setState(chatState);

					if (chat.firstMessage){
						if (chatState == dojox.xmpp.chat.ACTIVE_STATE) {
							chat.firstMessage = false;
						}
					}
				}
			} 

			if ((!message.body || message.body=="") && !message.xhtml) {return;}

			if (found>-1){
				var chat = this.chatRegister[found];
				chat.recieveMessage(message);
			}else{
				var chatInstance = new dojox.xmpp.ChatService();
				chatInstance.uid = this.getBareJid(message.from);
				chatInstance.chatid = message.chatid;
				
				chatInstance.firstMessage = true;
				if(!chatState || chatState != dojox.xmpp.chat.ACTIVE_STATE){
					chatInstance.useChatState = false;
				}else{
					chatInstance.useChatState = true;
				}
				this.registerChatInstance(chatInstance, message);
			}
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

		registerChatInstance: function(chatInstance, message){
			chatInstance.setSession(this);
			this.chatRegister.push(chatInstance);
			this.onRegisterChatInstance(chatInstance, message);
			chatInstance.recieveMessage(message,true);
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

		rosterSetHandler: function(elem){
			//console.log("xmppSession::rosterSetHandler()", arguments);
			for (var i=0; i<elem.childNodes.length;i++){
				var n = elem.childNodes[i];
			
				if (n.nodeName=="item"){
					var found = false;
					var state = -1;
					var rosterItem = null;
					var previousCopy = null;
					for(var x=0; x<this.roster.length;x++){
						var r = this.roster[x];
						if(n.getAttribute('jid')==r.jid){
							found = true;
							if(n.getAttribute('subscription')=='remove'){
								//remove the item
								rosterItem = {
									id: r.jid,
									name: r.name,
									groups:[]
								}

								for (var y=0;y<r.groups.length;y++){
									rosterItem.groups.push(r.groups[y]);
								}

								this.roster.splice(x,1);
								state = dojox.xmpp.roster.REMOVED;

							} else { //update
								previousCopy = dojo.clone(r);
								var itemName = n.getAttribute('name');
								if (itemName){
									this.roster[x].name = itemName;
								}	

								r.groups = [];

								if (n.getAttribute('subscription')){
									r.status = n.getAttribute('subscription');
								}
						
								r.substatus = dojox.xmpp.presence.SUBSCRIPTION_SUBSTATUS_NONE;
								if(n.getAttribute('ask')=='subscribe'){
									r.substatus = dojox.xmpp.presence.SUBSCRIPTION_REQUEST_PENDING;
								}
					
								for(var y=0;y<n.childNodes.length;y++){
									var groupNode = n.childNodes[y];
									if ((groupNode.nodeName=='group')&&(groupNode.hasChildNodes())){
										var gname = groupNode.firstChild.nodeValue;
										r.groups.push(gname);
									}
								}
								rosterItem = r;
								state = dojox.xmpp.roster.CHANGED;
							}
							break;
						}
					}
					if(!found && (n.getAttribute('subscription')!='remove')){
						r = this.createRosterEntry(n);
						rosterItem = r;
						state = dojox.xmpp.roster.ADDED;
						this.roster.push(r);
					}
				
					switch(state){
						case dojox.xmpp.roster.ADDED:
							this.onRosterAdded(rosterItem);
							break;
						case dojox.xmpp.roster.REMOVED:
							this.onRosterRemoved(rosterItem);
							break;
						case dojox.xmpp.roster.CHANGED:
							this.onRosterChanged(rosterItem, previousCopy);
							break;
					}	
				}	
			}
		},

		presenceUpdate: function(msg){
			if(msg.getAttribute('to')){
				var jid = this.getBareJid(msg.getAttribute('to'));
				if(jid != this.jid) {
					//console.log("xmppService::presenceUpdate Update Recieved with wrong address - ",jid);
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
			////console.log("xmppService::retrieveRoster()");
			var props={
				id: this.getNextIqId(),
				from: this.jid + "/" + this.resource,
				type: "get"
			}
			var req = new dojox.string.Builder(dojox.xmpp.util.createElement("iq",props,false));
			req.append(dojox.xmpp.util.createElement("query",{xmlns: "jabber:iq:roster"},true));
			req.append("</iq>");

			var def = this.dispatchPacket(req,"iq", props.id);
			def.addCallback(this, "onRetrieveRoster");
		},

		getRosterIndex: function(jid){
			if(jid.indexOf('@')==-1){
				jid += '@' + this.domain;
			}
			for (var i=0; i<this.roster.length;i++){
				if(jid == this.roster[i].jid) { return i; }
			}
			return -1;
		},

		createRosterEntry: function(elem){
			////console.log("xmppService::createRosterEntry()");
			var re = {
				name: elem.getAttribute('name'),
				jid: elem.getAttribute('jid'),
				groups: [],
				status: dojox.xmpp.presence.SUBSCRIPTION_NONE,
				substatus: dojox.xmpp.presence.SUBSCRIPTION_SUBSTATUS_NONE
			//	displayToUser: false
			}	

			if (!re.name){
				re.name = re.id;
			}
			
			

			for(var i=0; i<elem.childNodes.length;i++){
				var n = elem.childNodes[i];
				if (n.nodeName=='group' && n.hasChildNodes()){
					re.groups.push(n.firstChild.nodeValue);
				}
			} 

			if (elem.getAttribute('subscription')){
				re.status = elem.getAttribute('subscription');
			}	

			if (elem.getAttribute('ask')=='subscribe'){
				re.substatus = dojox.xmpp.presence.SUBSCRIPTION_REQUEST_PENDING;
			}	
			//Display contact rules from http://www.xmpp.org/extensions/xep-0162.html#contacts
		/*	if(re.status == dojox.xmpp.presence.SUBSCRIPTION_REQUEST_PENDING || 
				re.status == dojox.xmpp.presence.SUBSCRIPTION_TO || 
				re.status == dojox.xmpp.presence.SUBSCRIPTION_BOTH ||
				re.groups.length > 0 ||
				re.name
				) {
					re.displayToUser = true;
				}
*/
			return re;
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
				if (this["on"+state]){
					this["on"+state](state, this.state, message);
				}	
				this.state=state;
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
			this.retrieveRoster();
		},

		onLoginFailure: function(msg){
			//console.log("xmppSession::onLoginFailure ", msg);
		},

		onSearchResults: function(results){
			//console.log("xmppSession::onSearchResult() ", results);
		},

		onRetrieveRoster: function(msg){
			////console.log("xmppService::onRetrieveRoster() ", arguments);
			if ((msg.getAttribute('type')=='result') && msg.hasChildNodes()){
				var query = msg.getElementsByTagName('query')[0];
				if (query.getAttribute('xmlns')=="jabber:iq:roster"){
					for (var i=0;i<query.childNodes.length;i++){
						if (query.childNodes[i].nodeName=="item"){
							this.roster[i] = this.createRosterEntry(query.childNodes[i]);
						}
					}
				}	
			}else if(msg.getAttribute('type')=="error"){
				//console.log("xmppService::storeRoster()  Error recieved on roster get");	
			}

			////console.log("Roster: ", this.roster);
			this.setState(dojox.xmpp.xmpp.ACTIVE);
			this.onRosterUpdated();

			return msg;	
		},
		
		onRosterUpdated: function() {},

		onSubscriptionRequest: function(req){},

		onPresenceUpdate: function(p){},

		onTransportReady: function(){
			this.setState(dojox.xmpp.xmpp.CONNECTED);
			this.rosterService = new dojox.xmpp.RosterService(this);
			this.presenceService= new dojox.xmpp.PresenceService(this);
			this.userService = new dojox.xmpp.UserService(this);

			////console.log("xmppSession::onTransportReady()");
		},

		onTransportTerminate: function(newState, oldState, message){
			this.setState(dojox.xmpp.xmpp.TERMINATE, message);
		},

		onConnected: function(){
			////console.log("xmppSession::onConnected()");
		},

		onTerminate: function(newState, oldState, message){
			//console.log("xmppSession::onTerminate()", newState, oldState, message);
		},

		onActive: function(){
			////console.log("xmppSession::onActive()");
			//this.presenceService.publish({show: dojox.xmpp.presence.STATUS_ONLINE});
		},

		onRegisterChatInstance: function(chatInstance, message){
			////console.log("xmppSession::onRegisterChatInstance()");
		},

		onConnectionReset: function(args){

		},

		onUnableToCreateConnection: function(args){
			
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
