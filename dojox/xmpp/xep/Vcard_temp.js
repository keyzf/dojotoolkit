dojo.provide("dojox.xmpp.xep.Vcard_temp");

dojo.declare("dojox.xmpp.xep.Vcard_temp", null, {
    _session: null,
    _queue: null,
    _rosterLoaded: false,
    constructor: function(session){
        this._session = session;
        this._queue = [];
    },
    _initStore: function(){
        if(this._rosterStore){
            return;
        }
        this._rosterStore = this._session.rosterStore;
        if(!this._rosterStore){
            return;
        }
        dojo.connect(this._rosterStore, "onRosterLoaded", this, function(){
            this._rosterLoaded = true;
            this._processQueue();
        });
    },
    fetchVcard: function(jid){
        this._initStore();
        var outdef = new dojo.Deferred();
        this._queue.push({def: outdef, jid:jid});
        this._processQueue();
        return outdef;
    },
    _processQueue: function(){
        if(!this._rosterLoaded){
            return;
        }
        if(this._processQueueTimeout){
            clearTimeout(this._processQueueTimeout);
            this._processQueueTimeout = null;
        }
        if(this._queue.length){
            var item=this._queue.shift();
            this._fetchVcard(item.jid, item.def);
            this._processQueueTimeout = setTimeout(dojo.hitch(this, "_processQueue"),60000);
        }
    },
    _fetchVcard: function(jid, outdef){
        var props = {
            id: this._session.getNextIqId(),
            type: "get"
        };
        if(jid){
            props.to = jid;
        }
        var req = new dojox.string.Builder();
        req.append(
            dojox.xmpp.util.createElement("iq",props,false),
                dojox.xmpp.util.createElement("vCard",{xmlns: "vcard-temp"},true),
            "</iq>"
        );
        var indef = this._session.dispatchPacket(req, "iq", props.id);
        indef.addCallback(dojo.hitch(this, function(msg){
            this._onVcardFetched(jid, outdef, msg);
            setTimeout(dojo.hitch(this, "_processQueue"), 500);
        }));
    },
    _onVcardFetched: function(jid, def, msg) {
        if (msg.getAttribute('type') == 'result') {
            // Iterate over roster items
            var session = this._session;
            var vCard = dojo.query("iq>vCard", msg)[0];
            if(vCard){
                var FN = dojo.query("vCard>FN", vCard)[0];
                var N = dojo.query("vCard>N", vCard)[0];
                var GIVEN = dojo.query("N>GIVEN", N)[0];
                var MIDDLE = dojo.query("N>MIDDLE", N)[0];
                var FAMILY = dojo.query("N>FAMILY", N)[0];
                var NICKNAME = dojo.query("vCard>NICKNAME", vCard)[0];
                var vCardDetails = {
                    FN: FN && FN.textContent,
                    N: {
                        GIVEN: GIVEN && GIVEN.textContent,
                        MIDDLE: MIDDLE && MIDDLE.textContent,
                        FAMILY: FAMILY && FAMILY.textContent
                    },
                    NICKNAME: NICKNAME && NICKNAME.textContent
                };
                def.callback({jid:jid, vCardDetails:vCardDetails});
            }            
            else {
                def.errback(msg);
            }
        } else if (msg.getAttribute('type') == "error") {
            def.errback(msg);
        }
    }
});