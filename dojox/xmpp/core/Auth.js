dojo.provide("dojox.xmpp.core.Auth");

dojo.require("dojox.xmpp.core._sasl");
dojo.require("dojox.xmpp.util");

dojo.declare("dojox.xmpp.core.Auth", null, {
	_BIND_NS: "urn:ietf:params:xml:ns:xmpp-bind",
	_SESSION_NS: "urn:ietf:params:xml:ns:xmpp-session",
	_SASL_NS: "urn:ietf:params:xml:ns:xmpp-sasl",
	
	_chosenAuthMechanism: null,
	
	constructor: function(session, username, password, resource){
		this._session = session;
		
		if (!username) {
			throw new Error("User id cannot be null");
		} else {
			var jid = username;
			if (username.indexOf('@') == -1) {
				jid = jid + '@' + session.domain;
			}
			session.jid = this._jid = jid;
		}
		
		this._password = session.password = password;
		
		//normally you should NOT supply a resource and let the server send you one
		//as part of your jid...see onBindResource()
		if (resource) {
			this._resource = session.resource = resource;
		}
		
		this._registerPacketListeners(0);
	},
	
	_registerPacketListeners: function(stage) {
		var session = this._session;
		
		if(!stage) {
            this._featuresHandlerHandle = session.registerPacketHandler({
                name: "features",
                condition: function(msg){
                    // Unfortunately, dojo.query doesn't support namespaced element names in FF. Bummer. Getting the node name manually here.
                    return msg.nodeName.split(":").pop() === "features";
                },
                handler: dojo.hitch(this, this._readFeatures)
            });
		} else {
            var saslXmlns = "";//"[xmlns='" + this._SASL_NS + "']";
            
			this._saslSuccessHandle = session.registerPacketHandler({
                name: "sasl::onSuccess",
                condition: "success" + saslXmlns,
                handler: dojo.hitch(this._chosenAuthMechanism, "onSuccess")
            });
            
            this._saslChallengeHandle = session.registerPacketHandler({
                name: "sasl::onChallenge",
                condition: "challenge" + saslXmlns,
                handler: dojo.hitch(this._chosenAuthMechanism, "onChallenge")
            });

            this._saslFailureHandle = session.registerPacketHandler({
                name: "sasl::onFailure",
                condition: "failure" + saslXmlns,
                handler: function(msg) {
                    session.onLoginFailure(msg.firstChild.nodeName);
                }
            });
		}
	},
    
	_readFeatures: function(msg){
		if (!this._chosenAuthMechanism) {
			// Auth isn't done yet. Finish that first.
			var authMechanisms = dojo.query("mechanisms mechanism", msg).map(function(mechanismNode){
				return mechanismNode.firstChild.nodeValue;
			});
			// start the login
			for(var i = 0; i < authMechanisms.length; i++) {
				try {
					this._chosenAuthMechanism = dojox.xmpp.core._sasl.registry.match(authMechanisms[i], this._session);
					break;
				} catch (e) {
					console.warn("No suitable auth mechanism found for: ", authMechanisms[i]);
				}
			}
            this._registerPacketListeners(1);
		} else {
			// Auth is done. Do bind if necessary.
			var bindXmlns = "";//"[xmlns='" + this._BIND_NS + "']";
			var sessionXmlns = "";//"[xmlns='" + this._SESSION_NS + "']";
			var hasBindFeature = !!dojo.query("bind" + bindXmlns, msg).length;
			var hasSessionFeature = !!dojo.query("session", msg).length;
			
			if(hasBindFeature) {
				this._bindResource(hasSessionFeature);
			}
		}
	},
	
	_bindResource: function(hasSessionFeature) {
        var props = {
            id: this._session.getNextIqId(),
            type: "set"
        };
		
        var bindReq = new dojox.string.Builder(dojox.xmpp.util.createElement("iq", props, false));
        bindReq.append(dojox.xmpp.util.createElement("bind", {xmlns: this._BIND_NS}, false));

        if(this._resource){
            bindReq.append(
                dojox.xmpp.util.createElement("resource"),
                    this._resource,
                "</resource>"
			);
        }

        bindReq.append("</bind></iq>");

        var def = this._session.dispatchPacket(bindReq, "iq", props.id);
        def.addCallback(this, function(msg){
            this._onBindResource(msg, hasSessionFeature);
            return msg;
        });
	},
	
	_onBindResource: function(msg, hasSessionFeature) {
		var session = this._session;
        if (msg.getAttribute('type')=='result'){
            //console.log("xmppSession::onBindResource() Got Result Message");
			dojo.query("bind[xmlns='" + this._BIND_NS + "']", msg).forEach(function(bindNode) {
				var fullJid = dojo.query("jid", bindNode)[0].firstChild.nodeValue;
				this._jid = session.jid = dojox.xmpp.util.getBareJid(fullJid);
				this._resource = session.resource = dojox.xmpp.util.getResourceFromJid(fullJid);
				
                if(hasSession){
                    var props = {
                        id: session.getNextIqId(),
                        type: "set"
                    }
                    var bindReq = new dojox.string.Builder(dojox.xmpp.util.createElement("iq", props, false));
                    bindReq.append(dojox.xmpp.util.createElement("session", {xmlns: dojox.xmpp.xmpp.SESSION_NS}, true), "</iq>");

                    var def = this.dispatchPacket(bindReq, "iq", props.id);
                    def.addCallback(this, "_onBindSession");
                    return;
                }
			}, this)

            session.onLogin();
        }else if(msg.getAttribute('type')=='error'){
            var err = session.processXmppError(msg);
            session.onLoginFailure(err);
        }
	},
	
	_onBindSession: function() {
        if(msg.getAttribute('type')=='error'){
            var err = session.processXmppError(msg);
            session.onLoginFailure(err);
        }else{
            session.onLogin();
        }
	}
});