dojo.provide("dojox.xmpp.ChatService");

dojox.xmpp.chat = {
	CHAT_STATE_NS: 'http://jabber.org/protocol/chatstates',

	ACTIVE_STATE: 'active',
	COMPOSING_STATE: 'composing',
	INACTIVE_STATE: 'inactive',
	PAUSED_STATE: 'paused',
	GONE_STATE: 'gone'
}

dojo.declare("dojox.xmpp.ChatService", null, {
	state: "",
	_invited: false,

	constructor: function(jid, chatid){
		this.state="";
		if(chatid){
			this.chatid=chatid;
			this._invited=true;
		}
		else{
			this.chatid = Math.round(Math.random() * 1000000000000000);
		}
		if(jid){
			this.jid=jid;
			this.uid=dojox.xmpp.util.getBareJid(jid);
		}
	},
	
	receiveMessage: function(msg,initial){
		if (msg&&!initial){
			this.jid = msg.from;
			this.onNewMessage(msg);
		}
	},

	setSession: function(session){
		this.session = session;
		this._invite();
	},

	setState: function(state){
		if (this.state != state){
			this.state = state;
		}
	},
	
	_invite: function(){
		if (this._invited){return;}
		var req = {
			xmlns: "jabber:client",
			to: this.uid,
			from: this.session.jid + "/" + this.session.resource,
			type: "chat"
		}
		var request = new dojox.string.Builder(dojox.xmpp.util.createElement("message", req, false));
		request.append(
			dojox.xmpp.util.createElement("thread",{},false),
				this.chatid,
			"</thread>",
			dojox.xmpp.util.createElement("active",{xmlns: dojox.xmpp.chat.CHAT_STATE_NS},true),
			"</message>");
		this.session.dispatchPacket(request.toString());

		this._invited = true;
		this.onInvite(this.uid);
		this.setState(dojox.xmpp.chat.CHAT_STATE_NS);
	},

	sendBuzz: function(msg){
		if(!this.uid){
			return;
		}
		
		var req = {
			xmlns: "jabber:client",
			to: this.jid || this.uid,
			from: this.session.jid + "/" + this.session.resource,
			type: "chat"
		}
		
		var message = new dojox.string.Builder(dojox.xmpp.util.createElement("message",req,false));

		var html = dojox.xmpp.util.createElement("html", { "xmlns":dojox.xmpp.xmpp.XHTML_IM_NS},false);
		var attention  = dojox.xmpp.util.createElement("attention",{"xmlns":"urn:xmpp:attention:0"},false);
		var bodyTag = dojox.xmpp.util.createElement("body", {"xml:lang":this.session.lang, "xmlns":dojox.xmpp.xmpp.XHTML_BODY_NS}, false) + msg.body + "</body>";
		var bodyPlainTag = dojox.xmpp.util.createElement("body", {}, false) + dojox.xmpp.util.stripHtml(msg.body) + "</body>";

		if (message.subject && message.subject != "") {
			message.append(dojox.xmpp.util.createElement("subject", {}, false), message.subject, "</subject>");
		}
		message.append(attention,"</attention>",bodyPlainTag, html, bodyTag, "</html>");

		if(this.chatid){
			message.append(dojox.xmpp.util.createElement("thread", {}, false), this.chatid, "</thread>");
		}

		if (this.useChatState){
			message.append(dojox.xmpp.util.createElement("active",{xmlns: dojox.xmpp.chat.CHAT_STATE_NS},true));
			this._currentState = dojox.xmpp.chat.ACTIVE_STATE;
		}
		message.append("</message>");
		this.onMessageCreated(message.toString(),this.uid, this.session.jid);
		this.session.dispatchPacket(message.toString());
	},
	sendMessage: function(msg){
		if (!this.uid){
			//console.log("ChatService::sendMessage() -  Contact Id is null, need to invite to chat");
			return;
		}

		if ((!msg.body || msg.body=="") && !msg.xhtml){return;}
		
		var req = {
			xmlns: "jabber:client",
			to: this.jid || this.uid,
			from: this.session.jid + "/" + this.session.resource,
			type: "chat"
		}
		
		var message = new dojox.string.Builder(dojox.xmpp.util.createElement("message",req,false));

		var html = dojox.xmpp.util.createElement("html", { "xmlns":dojox.xmpp.xmpp.XHTML_IM_NS},false);

		var bodyTag = dojox.xmpp.util.createElement("body", {"xml:lang":this.session.lang, "xmlns":dojox.xmpp.xmpp.XHTML_BODY_NS}, false) + msg.body + "</body>";
		var bodyPlainTag = dojox.xmpp.util.createElement("body", {}, false) + dojox.xmpp.util.stripHtml(msg.body) + "</body>";
/*
		if (msg.xhtml){
			if (msg.xhtml.getAttribute('xmlns') != dojox.xmpp.xmpp.XHTML_IM_NS){
				//console.log("ChatService::sendMessage() - Cannot use this xhtml without the propper xmlns");
			}else{
				//FIXME do this in some portable way
				//console.log("ChatService::sendMessage() - FIXME Serialize XHTML to string: ", msg.xhtml.toString());
			}
		}
*/
		if (message.subject && message.subject != "") {
			message.append(dojox.xmpp.util.createElement("subject", {}, false), message.subject, "</subject>");
		}
		message.append(bodyPlainTag, html, bodyTag, "</html>");

		if(this.chatid){
			message.append(dojox.xmpp.util.createElement("thread", {}, false), this.chatid, "</thread>");
		}

		if (this.useChatState){
			message.append(dojox.xmpp.util.createElement("active",{xmlns: dojox.xmpp.chat.CHAT_STATE_NS},true));
			this._currentState = dojox.xmpp.chat.ACTIVE_STATE;
		}
		message.append("</message>");
		this.onMessageCreated(message.toString(),this.uid, this.session.jid);
		this.session.dispatchPacket(message.toString());
	},
	onMessageCreated: function(message,toUser,fromUser){
		
	},
	sendChatState: function(state){
		if (!this.useChatState){return;}
		if (state==this._currentState){return;}
		
		var req={
			xmlns: "jabber:client",
			to: this.jid || this.uid,
			from: this.session.jid + "/" + this.session.resource,
			type: "chat"
		}

		var request = new dojox.string.Builder(dojox.xmpp.util.createElement("message",req,false));	
		request.append(dojox.xmpp.util.createElement(state, {xmlns: dojox.xmpp.chat.CHAT_STATE_NS},true));
		this._currentState = state;
		if(this.chatid){
			request.append("<thread>", this.chatid, "</thread>");
		}

		request.append("</message>");

		this.session.dispatchPacket(request.toString());
	},

	//EVENTS 
	onNewMessage: function(msg){},
	onInvite: function(contact){}
});
