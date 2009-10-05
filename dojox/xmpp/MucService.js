/*global dojo, dojox */

dojo.provide("dojox.xmpp.MucService");

dojox.xmpp.muc = {
    NS: "http://jabber.org/protocol/muc",
    USER_NS: "http://jabber.org/protocol/muc#user",
    ADMIN_NS: "http://jabber.org/protocol/muc#admin",
    OWNER_NS: "http://jabber.org/protocol/muc#owner",
    UNIQUE_NS: "http://jabber.org/protocol/muc#unique"
};

dojo.declare("dojox.xmpp.muc.Room", null, {
    constructor: function(jid, mucService){
        this.bareJid = jid;
        this.roomId = dojox.xmpp.util.getNodeFromJid(jid);
        this.domain = dojox.xmpp.util.getDomainFromJid(jid);
        this.mucService = mucService;
        this.session = mucService.session;
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
        if(this.entered){
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
        this.entered = true;
        this.nick = nick;

        var def = this.session.dispatchPacket(request.toString());
        return def;
    },
    
    exit: function(status){
        if(!this.entered){
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

        this.entered = false;

        var def = this.session.dispatchPacket(request.toString());
        return def;
    },
    
    changeNick: function(){},
    sendMessage: function(){},
    changeSubject: function(){},
    invite: function(){}
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
    }
});