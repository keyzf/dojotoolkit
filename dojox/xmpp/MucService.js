/*global dojo, dojox */

dojo.provide("dojox.xmpp.MucService");

dojox.xmpp.muc = {
    NS: "http://jabber.org/protocol/muc",
    USER_NS: "http://jabber.org/protocol/muc#user",
    ADMIN_NS: "http://jabber.org/protocol/muc#admin",
    OWNER_NS: "http://jabber.org/protocol/muc#owner",
    UNIQUE_NS: "http://jabber.org/protocol/muc#unique"
};

dojox.xmpp.muc.roomState = {
    NONE: 0,
    ENTERING: 1,
    ENTERED: 2,
    EXITING: 3
}

dojo.declare("dojox.xmpp.muc.Room", null, {
    state: dojox.xmpp.muc.roomState.NONE,
    
    constructor: function(jid, mucService){
        this.bareJid = jid;
        this.roomId = dojox.xmpp.util.getNodeFromJid(jid);
        this.domain = dojox.xmpp.util.getDomainFromJid(jid);
        this.mucService = mucService;
        this.session = mucService.session;
        this._occupants = {};
        this.subject = null;
    },

    roomJid: function(){
        return this.bareJid + "/" + this.nick;
    },
    
    getInfo: function(){
        if(!this.session){
            throw new Error("MucService::Room::getInfo() No session associated with room.");
        }
        
        var iqId = this.session.getNextIqId();
        var req = {
            id: iqId,
            from: dojox.xmpp.util.encodeJid(this.session.fullJid()),
            to: dojox.xmpp.util.encodeJid(this.bareJid),
            type: "get"
        }

        var request = new dojox.string.Builder(dojox.xmpp.util.createElement("iq", req, false));
        request.append(dojox.xmpp.util.createElement("query", {xmlns: dojox.xmpp.xmpp.DISCO_INFO_NS}, true));
        request.append("</iq>");

        var def = this.session.dispatchPacket(request.toString(), "iq", req.id);
        def.addCallback(this, function(res){
            if(res.getAttribute("type") === "result"){
                var queryNode = dojo.query("query", res)[0];
                var result = this._extractRoomInfo(queryNode);
                dojo.mixin(this, result);
                this.onRoomInfoReceived();
            }else{
                var err = this.session.processXmppError(res);
                this.onRoomInfoReceiveFailed(err);
            }
        });
        return def;
    },

    _extractRoomInfo: function(queryNode){
        var identityNode = dojo.query("identity", queryNode)[0];
        var featureNodes = dojo.query("feature", queryNode);

        var result = {
            category: identityNode.getAttribute("category"),
            name: identityNode.getAttribute("name"),
            type: identityNode.getAttribute("type")
        };
        
        var features = {}
        for(var i = 0; i < featureNodes.length; ++i){
            var node = featureNodes[i];
            var featureVar = node.getAttribute("var");
            switch(featureVar){
                case "muc_hidden":
                    features.hidden = true;
                    break;
                case "muc_membersonly":
                    features.membersOnly = true;
                    break;
                case "muc_moderated":
                    features.moderated = true;
                    break;
                case "muc_nonanonymous":
                    features.nonAnonymous = true;
                    break;
                case "muc_open":
                    features.open = true;
                    break;
                case "muc_passwordprotected":
                    features.passwordProtected = true;
                    break;
                case "muc_persistent":
                    features.persistent = true;
                    break;
                case "muc_public":
                    features.public = true;
                    break;
                case "muc_semianonymous":
                    features.semiAnonymous = true;
                    break;
                case "muc_temporary":
                    features.temporary = true;
                    break;
                case "muc_unmoderated":
                    features.unmoderated = true;
                    break;
                case "muc_unsecured":
                    features.unsecured = true;
                    break;
            }
        }

        result.features = features;
        return result;
    },

    enter: function(nick, password){
        if(!nick){
            throw new Error("MucService::Room::enter() nick is null or undefined");
        }

        if(this.state === dojox.xmpp.muc.roomState.ENTERED){
            return;
        }

        // first do a feature check on the room before entering
        if(!this.features){
            var retval;
            var successHandle = dojo.connect(this, "onRoomInfoReceived", this, function(){
                retval = this.enter(nick, password);
                dojo.disconnect(successHandle);
                dojo.disconnect(failHandle);
            });
            var failHandle = dojo.connect(this, "onRoomInfoReceiveFailed", this, function(err){
                this.onEnterFailed(err);
                dojo.disconnect(successHandle);
                dojo.disconnect(failHandle);
            });
            this.getInfo();
            return retval;
        }

        // password required?
        if(this.features.passwordProtected && !password){
            throw new Error("MucService::Room::enter() Can't enter room -- need password.");
        }

        // Build the <presence> packet to send
        var request = new dojox.string.Builder(dojox.xmpp.util.createElement("presence", {
            from: dojox.xmpp.util.encodeJid(this.session.fullJid()),
            to: dojox.xmpp.util.encodeJid(this.bareJid + "/" + nick)
        }, false));

        var x = new dojox.string.Builder(dojox.xmpp.util.createElement("x", {
            xmlns: dojox.xmpp.muc.NS
        }, false));
        if(password){
            x.append("<password>" + password + "</password>");
        }
        x.append("</x>");

        request.append(x);
        request.append("</presence>");

        // TODO: verify that we really are in the room
        this.state = dojox.xmpp.muc.roomState.ENTERING;
        this.nick = nick;

        var def = this.session.dispatchPacket(request.toString());
        return def;
    },
    
    exit: function(status){
        if(this.state === dojox.xmpp.muc.roomState.NONE){
            return;
        }

        var request = new dojox.string.Builder(dojox.xmpp.util.createElement("presence", {
            from: dojox.xmpp.util.encodeJid(this.session.fullJid()),
            to: dojox.xmpp.util.encodeJid(this.roomJid()),
            type: "unavailable"
        }, false));
        if(status){
            request.append("<status>" + status + "</status>");
        }
        request.append("</presence>");

        this.state = dojox.xmpp.muc.roomState.EXITING;

        var def = this.session.dispatchPacket(request.toString());
        return def;
    },
    
    changeNick: function(newNick){
        if(!newNick){
            throw new Error("MucService::Room::changeNick() newNick is null or undefined");
        }
        var request = new dojox.string.Builder(dojox.xmpp.util.createElement("presence", {
            from: dojox.xmpp.util.encodeJid(this.session.fullJid()),
            to: dojox.xmpp.util.encodeJid(this.bareJid + "/" + newNick)
        }, true));

        var def = this.session.dispatchPacket(request.toString());
        return def;
    },

    sendMessage: function(msg, toNick){
        if(!msg || !msg.body){
            throw new Error("MucService::Room::sendMessage() msg or msg.body is null or undefined");
        }
        
        var req = {
			to: toNick ? this.bareJid + "/" + toNick : this.bareJid,
			from: this.session.fullJid(),
			type: toNick ? "chat" : "groupchat"
		}

        // for now we do what ChatService.js does and punt on handling xhtml-im
		var message = new dojox.string.Builder(dojox.xmpp.util.createElement("message",req,false));

        var html = dojox.xmpp.util.createElement("html", { "xmlns":dojox.xmpp.xmpp.XHTML_IM_NS},false)
		var bodyTag = dojox.xmpp.util.createElement("body", {"xml:lang":this.session.lang, "xmlns":dojox.xmpp.xmpp.XHTML_BODY_NS}, false) + msg.body + "</body>";
		var bodyPlainTag = dojox.xmpp.util.createElement("body", {}, false) + dojox.xmpp.util.stripHtml(msg.body) + "</body>";

        message.append(bodyPlainTag);
		message.append(html);
		message.append(bodyTag);
		message.append("</html>");

        message.append("</message>");

        this.session.dispatchPacket(message.toString());
    },
    
    changeSubject: function(string){
        if(!string){
            throw new Error("MucService::Room::changeSubject() string is null or undefined");
        }
        var req = {
            to: this.bareJid,
            from: this.session.fullJid(),
            type: "groupchat"
        }

        var message = new dojox.string.Builder(dojox.xmpp.util.createElement("message", req, false));
        message.append("<subject>" + string + "</subject>");
        message.append("</message>");

        this.session.dispatchPacket(message.toString());
    },

    invite: function(to, reason){
        if(!to){
            throw new Error("MucService::Room::invite() to is null or undefined");
        }

        var message = new dojox.string.Builder(dojox.xmpp.util.createElement("message", {
            to: this.bareJid,
            from: this.session.fullJid()
        }, false));

        var x = new dojox.string.Builder(dojox.xmpp.util.createElement("x", {
            xmlns: dojox.xmpp.muc.USER_NS
        }, false));

        var inviteTag = new dojox.string.Builder(dojox.xmpp.util.createElement("invite", {
            to: to
        }, false));
        inviteTag.append("<reason>" + reason + "</reason>");
        inviteTag.append("</invite>");

        x.append(inviteTag);
        x.append("</x>");

        message.append(x);
        message.append("</message>");

        this.session.dispatchPacket(message.toString());
    },

    getOccupants: function(){
        return this._occupants;
    },

    _addOccupant: function(nick, item){
        var oldItem = this._occupants[nick];
        if(!oldItem){
            this._occupants[nick] = item;
            this.onNewOccupant(item);
        }else{
            this._occupants[nick] = item;
            this.onOccupantUpdate(oldItem, item);
        }
    },

    _removeOccupant: function(nick){
        var item = this._occupants[nick];
        if(item){
            delete this._occupants[nick];
            this.onOccupantLeft(item);
        }
    },

    _updateNick: function(oldNick, newNick){
        var item = this._occupants[oldNick]
        if(item){
            delete this._occupants[oldNick];
            this._occupants[newNick] = item;
        }
    },

    handleMessage: function(msg){
        var type = msg.getAttribute("type");
        // copied from xmppSession.js
        var message = {
			from: msg.getAttribute('from'),
			to: msg.getAttribute('to')
		}
        for (var i=0; i<msg.childNodes.length; i++){
			var n = msg.childNodes[i];
			if (n.hasChildNodes()){
				//console.log("chat child node ", n);
				switch(n.nodeName){
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
					//console.log("xmppSession::chatHandler() Unknown node type: ",n.nodeName);
				}
			}
		}
        var nodeOfInterest;
        if(nodeOfInterest = dojo.query("subject", msg)[0]){
            var subject = nodeOfInterest.textContent;
            this.subject = subject ? subject : null;
            this.onNewSubject(this.subject);
        }else if(nodeOfInterest = dojo.query('x[xmlns="' + dojox.xmpp.muc.USER_NS + '"] invite', msg)[0]){
            var inviteFrom = nodeOfInterest.getAttribute("from");
            var reason = dojo.query("reason", nodeOfInterest)[0].textContent;
            this.mucService.onInviteReceived(this.bareJid, inviteFrom, reason);
        }else if(type === "chat" || type === "groupchat"){
            this.onNewMessage(message);
        }
    },

    handlePresence: function(msg){
        var from = msg.getAttribute("from");
        var fromNick = dojox.xmpp.util.getResourceFromJid(from);
        var type = msg.getAttribute("type");
        var state = this.state;
        var xNodeQuery = 'x[xmlns="' + dojox.xmpp.muc.USER_NS + '"]'
        var itemNode = dojo.query(xNodeQuery + " item", msg)[0];

        var handleNickPresence = dojo.hitch(this, function(nick){
            if(type === null){
                var item = {
                    nick: nick,
                    roomJid: this.bareJid + "/" + nick,
                    jid: itemNode.getAttribute("jid"),
                    affiliation: itemNode.getAttribute("affiliation"),
                    role: itemNode.getAttribute("role")
                }
                this._addOccupant(nick, item);
            }else if(type === "unavailable"){
                var statusNode = dojo.query(xNodeQuery + " status", msg)[0];
                // nickname change only
                if(statusNode && statusNode.getAttribute("code") === "303"){
                    var newNick = itemNode.getAttribute("nick");
                    this._updateNick(nick, newNick);
                    if(nick === this.nick){
                        this.nick = newNick;
                    }
                }else{ // occupant left the room for good
                    this._removeOccupant(nick);
                }
            }
        });

        switch(state){
        case dojox.xmpp.muc.roomState.NONE:
            // nothing to do here
            break;
        case dojox.xmpp.muc.roomState.ENTERING:
            if((fromNick === "" || fromNick === this.nick) && type === "error"){
                this.state = dojox.xmpp.muc.roomState.NONE;
                var err = this.session.processXmppError(msg);
                this.onEnterFailed(err);
                break;
            }else if(fromNick !== ""){
                handleNickPresence(fromNick);
            }
            if(fromNick === this.nick){
                if(type !== "unavailable"){
                    this.state = dojox.xmpp.muc.roomState.ENTERED;
                    this.onEnter();
                }else{
                    this.state = dojox.xmpp.muc.roomState.NONE;
                }
            }
            break;
        case dojox.xmpp.muc.roomState.ENTERED:
            if(fromNick !== ""){
                handleNickPresence(fromNick);
            }
            if(fromNick === this.nick && type === "unavailable"){
                this.state = dojox.xmpp.muc.roomState.NONE;
            }
            break;
        case dojox.xmpp.muc.roomState.EXITING:
            if(fromNick === this.nick && type === "unavailable"){
                this._removeOccupant(this.nick);
                this.state = dojox.xmpp.muc.roomState.NONE;
                this.onExit();
            }
            break;
        }
    },

    // Events
    
    onRoomInfoReceived: function(){},
    
    onRoomInfoReceiveFailed: function(err){},

    onEnter: function(){},

    onEnterFailed: function(err){},

    onExit: function(){},

    onNewSubject: function(subject){},

    onNewOccupant: function(item){},
    
    onOccupantUpdate: function(oldItem, newItem){},
    
    onOccupantLeft: function(item){},

    onNewMessage: function(message){}
});

dojo.declare("dojox.xmpp.MucService", null, {
    rooms: {},
    
    constructor: function(domain){
        this.domain = domain;
    },
    
    setSession: function(session){
        this.session = session;
    },

    _addListeners: function(room){
        dojo.connect(room, "onEnter", this, function(){
            this.onEnter(room);
        });
        dojo.connect(room, "onEnterFailed", this, function(err){
            this.onEnterFailed(room, err);
        });
        dojo.connect(room, "onExit", this, function(){
            this.onExit(room);
        });
    },

    _getRoomList: function(setInfo, result){
        var self = this;
        var iqId = this.session.getNextIqId();
        var req = {
            id: iqId,
            from: dojox.xmpp.util.encodeJid(this.session.fullJid()),
            to: this.domain,
            type: "get"
        }

        var request = new dojox.string.Builder(dojox.xmpp.util.createElement("iq", req, false));
        request.append(dojox.xmpp.util.createElement("query", {xmlns: dojox.xmpp.xmpp.DISCO_ITEMS_NS}, false));
        if(setInfo){
            var setElement = new dojox.string.Builder(dojox.xmpp.util.createElement("set", {xmlns: dojox.xmpp.xmpp.RSM_NS}, false));
            if(setInfo.max){ setElement.append("<max>" + setInfo.max + "</max>"); }
            if(setInfo.before){ setElement.append("<before>" + setInfo.before + "</before>"); }
            if(setInfo.after){ setElement.append("<after>" + setInfo.after + "</after>"); }
            setElement.append("</set>");
            request.append(setElement);
        }
        request.append("</query>");
        request.append("</iq>");

        var def = this.session.dispatchPacket(request.toString(), "iq", req.id);
        def.addCallback(this, function(res){
            if(res.getAttribute("type") === "result"){
                var items = dojo.query("item", res);
                var rooms = [];
                for(i = 0; i < items.length; ++i){
                    var item = items[i];
                    var jid = item.getAttribute("jid");
                    var roomId = dojox.xmpp.util.getNodeFromJid(jid);
                    var room = this.rooms[roomId];
                    if(!room){
                        room = new dojox.xmpp.muc.Room(jid, this);
                        this.rooms[roomId] = room;
                        this._addListeners(room);
                    }
                    rooms.push(room);
                }
                result.onComplete(rooms);
                // FIXME for dojo.query: why doesn't plain query with
                // "set[xmlns=...]" work?
                var setElement = dojo.query('query set[xmlns="' + dojox.xmpp.xmpp.RSM_NS + '"]', res)[0];
                if(setElement){
                    var firstIndex = parseInt(dojo.query("first", setElement)[0].getAttribute("index"));
                    result.first = dojo.query("first", setElement)[0].textContent;
                    result.last = dojo.query("last", setElement)[0].textContent;
                    result.count = parseInt(dojo.query("count", setElement)[0].textContent);
                    // set next() and previous() handlers
                    if(firstIndex !== 0){ // first page
                        result.previous = function(){
                            self._getRoomList({
                                max: result.max,
                                before: result.first
                            }, result);
                        }
                    }else{
                        result.previous = null;
                    }
                    if(firstIndex + items.length !== result.count){ // last page
                        result.next = function(){
                            self._getRoomList({
                                max: result.max,
                                after: result.last
                            }, result);
                        }
                    }else{
                        result.next = null;
                    }
                }
            }else{
                var err = this.session.processXmppError(res);
                result.onError(err);
            }
        });
    },

    getRoomList: function(onComplete, onError, max){
        if(!onComplete){
            throw new Error("MucService::getRoomList() onComplete is null or undefined");
        }
        if(!onError){
            throw new Error("MucService::getRoomList() onError is null or undefined");
        }

        var result = {
            previous: null,
            next: null,
            onComplete: onComplete,
            onError: onError,
            max: max
        }

        if(max){
            this._getRoomList({ max: max }, result);
        }else{
            this._getRoomList(null, result);
        }

        return result;
    },

    getRoom: function(roomId){
        if(!roomId){
            throw new Error("MucService::getRoom() roomId is null or undefined");
        }
        var room = this.rooms[roomId];
        if(!room){
            var room = new dojox.xmpp.muc.Room(roomId + "@" + this.domain, this);
            this._addListeners(room);
            var connectHandle = dojo.connect(room, "onRoomInfoReceived", this, function(){
                this.rooms[roomId] = room;
                dojo.disconnect(connectHandle);
            });
        }
        return room;
    },

    enterRoom: function(room, nick, password){
        if(!room){
            throw new Error("MucService::enterRoom() room is null or undefined");
        }
        if(typeof room === "string"){
            room = this.getRoom(room);
        }
        room.enter(nick, password);
        return room;
    },

    handleMessage: function(msg){
        console.log("handleMessage called", msg);
        var from = msg.getAttribute("from");
        var roomId = dojox.xmpp.util.getNodeFromJid(from);
        var room = this.getRoom(roomId);
        room.handleMessage(msg);
    },

    handlePresence: function(msg){
        console.log("handlePresence called", msg);
        var from = msg.getAttribute("from");
        var roomId = dojox.xmpp.util.getNodeFromJid(from);
        var room = this.getRoom(roomId);
        room.handlePresence(msg);
    },

    // Events

    onRoomListReceived: function(rooms){},
    
    onRoomListReceiveFailed: function(err){},

    onInviteReceived: function(roomJid, from, reason){},

    onEnter: function(room){},

    onEnterFailed: function(room, err){},

    onExit: function(room){}
});