dojo.provide("dojox.xmpp.disco");

dojo.require("dojox.string.Builder");

dojox.xmpp.disco.info = function(session, to, node){
    var req = {
        id: session.getNextIqId(),
        from: dojox.xmpp.util.encodeJid(session.fullJid()),
        to: dojox.xmpp.util.encodeJid(to),
        type: "get"
    }

    var request = new dojox.string.Builder(dojox.xmpp.util.createElement("iq", req, false));
    var queryAttr = {xmlns: dojox.xmpp.xmpp.DISCO_INFO_NS}
    if(node){
        queryAttr["node"] = node;
    }
    request.append(dojox.xmpp.util.createElement("query", queryAttr, true));
    request.append("</iq>");

    var def = new dojo.Deferred();
    var sessionDef = session.dispatchPacket(request.toString(), "iq", req.id);
    sessionDef.addCallback(function(res){
        if(res.getAttribute("type") === "result"){
            var queryNode = dojo.query("query", res)[0];
            def.callback(queryNode.childNodes);
        }else{
            var err = session.processXmppError(res);
            def.errback(err);
        }
    });
    return def;
}

dojox.xmpp.disco.items = function(session, to, node, max){
    var sessionDef;
    var def = new dojo.Deferred();
    max = max || null;

    function dispatchRequest(max, before, after){
        var req = {
            id: session.getNextIqId(),
            from: dojox.xmpp.util.encodeJid(session.fullJid()),
            to: dojox.xmpp.util.encodeJid(to),
            type: "get"
        }

        var request = new dojox.string.Builder(dojox.xmpp.util.createElement("iq", req, false));
        var queryAttr = {xmlns: dojox.xmpp.xmpp.DISCO_ITEMS_NS}
        if(node){
            queryAttr["node"] = node;
        }
        request.append(dojox.xmpp.util.createElement("query", queryAttr, false));

        if(max || before || after){
            var setElement = new dojox.string.Builder(dojox.xmpp.util.createElement("set", {xmlns: dojox.xmpp.xmpp.RSM_NS}, false));
            if(max){ setElement.append("<max>" + max + "</max>"); }
            if(before){ setElement.append("<before>" + before + "</before>"); }
            if(after){ setElement.append("<after>" + after + "</after>"); }
            setElement.append("</set>");
            request.append(setElement);
        }

        request.append("</query>");
        request.append("</iq>");

        sessionDef = session.dispatchPacket(request.toString(), "iq", req.id);
        sessionDef.addCallback(handleResult);
    }

    function handleResult(res){
        if(res.getAttribute("type") === "result"){
            var items = dojo.query("item", res);
            var previous = null;
            var next = null;
            // FIXME for dojo.query: why doesn't plain query with
            // "set[xmlns=...]" work?
            var setElement = dojo.query('query set[xmlns="' + dojox.xmpp.xmpp.RSM_NS + '"]', res)[0];
            if(setElement){
                var firstIndex = parseInt(dojo.query("first", setElement)[0].getAttribute("index"));
                var first = dojo.query("first", setElement)[0].textContent;
                var last = dojo.query("last", setElement)[0].textContent;
                var count = parseInt(dojo.query("count", setElement)[0].textContent);
                // set next() and previous() handlers
                if(firstIndex !== 0){ // not on first page
                    previous = function(){
                        def = new dojo.Deferred();
                        dispatchRequest(max, first, null);
                        return def;
                    }
                }
                if(firstIndex + items.length !== count){ // not on last page
                    next = function(){
                        def = new dojo.Deferred();
                        dispatchRequest(max, null, last);
                        return def;
                    }
                }
            }
            def.callback({ items: items, next: next, previous: previous });
        }else{
            var err = session.processXmppError(res);
            def.errback(err);
        }
    }

    dispatchRequest(max);
    return def;
}