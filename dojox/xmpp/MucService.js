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
    },

    roomJid: function(){
        return this.bareJid + "/" + this.nick;
    },
    
    getInfo: function(){
        if(!this.session){
            throw new Error("No session associated with room.");
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

    onRoomInfoReceived: function(){},
    onRoomInfoReceiveFailed: function(){},

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
        if(this.state === dojox.xmpp.muc.roomState.ENTERED){
            return;
        }

        // first do a feature check on the room before entering
        if(!this.features){
            var retval;
            var connectHandle = dojo.connect(this, "onRoomInfoReceived", this, function(){
                retval = this.enter(nick, password);
                dojo.disconnect(connectHandle);
            });
            this.getInfo();
            return retval;
        }

        // password required?
        if(this.features.passwordProtected && !password){
            throw new Error("Can't enter room -- need password.");
        }

        // Build the <presence> packet to send
        var request = new dojox.string.Builder(dojox.xmpp.util.createElement("presence", {
            from: dojox.xmpp.util.encodeJid(this.session.fullJid()),
            to: dojox.xmpp.util.encodeJid(this.bareJid + "/" + nick)
        }, false));
        request.append(dojox.xmpp.util.createElement("x", {
            xmlns: dojox.xmpp.muc.NS
        }, true));
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
        var request = new dojox.string.Builder(dojox.xmpp.util.createElement("presence", {
            from: dojox.xmpp.util.encodeJid(this.session.fullJid()),
            to: dojox.xmpp.util.encodeJid(this.bareJid + "/" + newNick)
        }, true));

        var def = this.session.dispatchPacket(request.toString());
        return def;
    },

    sendMessage: function(){},
    changeSubject: function(){},
    invite: function(){},

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

    onNewOccupant: function(){},
    onOccupantUpdate: function(){},
    onOccupantLeft: function(){},

    _updateNick: function(oldNick, newNick){
        var item = this._occupants[oldNick]
        if(item){
            delete this._occupants[oldNick];
            this._occupants[newNick] = item;
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
            if(fromNick === "" && type === "error"){
                this.state = dojox.xmpp.muc.roomState.NONE;
                this.session.processXmppError(msg);
            }else if(fromNick !== ""){
                handleNickPresence(fromNick);
            }
            if(fromNick === this.nick){
                if(type !== "unavailable"){
                    this.state = dojox.xmpp.muc.roomState.ENTERED;
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
            }
            break;
        }
    }
});

dojo.declare("dojox.xmpp.MucService", null, {
    rooms: {},
    
    constructor: function(domain){
        this.domain = domain;
    },
    
    setSession: function(session){
        this.session = session;
    },

    // TODO: Handle result <set>
    getRoomList: function(){
        var iqId = this.session.getNextIqId();
        var req = {
            id: iqId,
            from: dojox.xmpp.util.encodeJid(this.session.fullJid()),
            to: this.domain,
            type: "get"
        }

        var request = new dojox.string.Builder(dojox.xmpp.util.createElement("iq", req, false));
        request.append(dojox.xmpp.util.createElement("query", {xmlns: dojox.xmpp.xmpp.DISCO_ITEMS_NS}, true));
        request.append("</iq>");

        var def = this.session.dispatchPacket(request.toString(), "iq", req.id);
        def.addCallback(this, function(res){
            if(res.getAttribute("type") === "result"){
                var items = dojo.query("item", res);
                for(i = 0; i < items.length; ++i){
                    var item = items[i];
                    var jid = item.getAttribute("jid");
                    var roomId = dojox.xmpp.util.getNodeFromJid(jid);
                    if (!this.rooms[roomId]){
                        var room = new dojox.xmpp.muc.Room(jid, this);
                        this.rooms[roomId] = room;
                    }
                }
                this.onRoomListReceived(this.rooms);
            }else{
                var err = this.session.processXmppError(res);
                this.onRoomListReceiveFailed(err);
            }
        });
        
        return def;
    },

    onRoomListReceived: function(){},
    onRoomListReceiveFailed: function(){},

    getRoom: function(roomId){
        var room = this.rooms[roomId];
        if(!room){
            room = new dojox.xmpp.muc.Room(roomId + "@" + this.domain, this);
            var connectHandle = dojo.connect(room, "onRoomInfoReceived", this, function(){
                this.rooms[roomId] = room;
                dojo.disconnect(connectHandle);
            });
            room.getInfo();
        }
        return room;
    },

    handleMessage: function(msg){
        console.log("handleMessage called", msg);
    },

    handlePresence: function(msg){
        console.log("handlePresence called", msg);
        var from = msg.getAttribute("from");
        var roomId = dojox.xmpp.util.getNodeFromJid(from);
        var room = this.getRoom(roomId);
        room.handlePresence(msg);
    }
});