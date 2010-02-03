dojo.provide("dojox.xmpp.disco");

dojo.require("dojox.string.Builder");

dojox.xmpp.disco.info = function(/*Object*/ props){
    // summary:
    //        Make a disco#info query
    // props:
    //        A hash of the various parameters needed, which are described below
    // onComplete: Function
    //        Called if the query was successful. Gets the <query> node returned
    //        by the respone as argument
    // onError: Function
    //        Called if the query was unsuccessful. Gets an error object as the
    //        single argument
    // session: xmppSession
    //        The current xmppSession
    // to: String
    //        The target entity (value of the "to" attribute in the <iq>
    //        element)
    // node: String?
    //        Optional. Info node towards which a request maybe directed (value
    //        of the "node" attribute in the <query> element)
    var session = props.session;
    var to = props.to;
    var node = props.node;
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

    var sessionDef = session.dispatchPacket(request.toString(), "iq", req.id);
    sessionDef.addCallback(function(res){
        if(res.getAttribute("type") === "result"){
            var queryNode = dojo.query("query", res)[0];
            props.onComplete(queryNode);
        }else{
            var err = session.processXmppError(res);
            props.onError(err);
        }
    });
}

dojox.xmpp.disco.items = function(props){
    // summary:
    //        Make a disco#items query
    // props:
    //        A hash of the various parameters needed, which are described below
    // onComplete: Function
    //        Called if the query was successful. Gets three parameters -- 1)
    //        the list of <item> nodes, 2) a handler for fetching the next set
    //        of results, and 3) a handler for fetching the previous set of
    //        results. If there are no next or previous pages, these parameters
    //        are null
    // onError: Function
    //        Called if the query was unsuccessful. Gets an error object as the
    //        single argument
    // session: xmppSession
    //        The current xmppSession
    // to: String
    //        The target entity (value of the "to" attribute in the <iq>
    //        element)
    // node: String
    //        Optional. Info node towards which a request maybe directed (value
    //        of the "node" attribute in the <query> element)
    // max: Integer
    //        Optional. Maximum number of items to receive in one response. Use
    //        paging to get next or previous values.
    var session = props.session;
    var to = props.to;
    var node = props.node;
    var max = props.max;
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
            if(setElement && dojo.query("first", setElement)[0]){
                var firstIndex = parseInt(dojo.query("first", setElement)[0].getAttribute("index"));
                var first = dojo.query("first", setElement)[0].textContent;
                var last = dojo.query("last", setElement)[0].textContent;
                var count = parseInt(dojo.query("count", setElement)[0].textContent);
                // set next() and previous() handlers
                if(firstIndex !== 0){ // not on first page
                    previous = function(){
                        dispatchRequest(max, first, null);
                    }
                }
                if(firstIndex + items.length !== count){ // not on last page
                    next = function(){
                        dispatchRequest(max, null, last);
                    }
                }
            }
            props.onComplete(items, next, previous);
        }else{
            var err = session.processXmppError(res);
            props.onError(err);
        }
    }

    dispatchRequest(max);
}