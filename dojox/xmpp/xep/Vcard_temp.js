dojo.provide("dojox.xmpp.xep.Vcard_temp");

dojo.declare("dojox.xmpp.xep.Vcard_temp", null, {
    _session: null,
    constructor: function(session){
        this._session = session;
    },
    fetchVcard: function(jid){
        var props = {
            id: this._session.getNextIqId(),
            type: "get",
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
        var outdef = new dojo.Deferred();
        indef.addCallback(dojo.hitch(this, function(msg){
            this.onVcardFetched(jid, outdef, msg);
        }));
        return outdef;
    },
    onVcardFetched: function(jid, def, msg) {
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
                }
                def.callback({jid:jid, vCardDetails:vCardDetails});
            }            
            def.errback(msg);
        } else if (msg.getAttribute('type') == "error") {
            def.errback(msg);
        }
    }
});