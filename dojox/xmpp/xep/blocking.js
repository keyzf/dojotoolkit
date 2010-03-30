dojo.provide("dojox.xmpp.xep.blocking");
dojo.require("dojox.xmpp.xmppSession");

dojo.declare("dojox.xmpp.xep.blocking", null, {
    isAvailable: false,
    constructor: function(session){
    this._session = session;
    this._session.registerPacketHandler({
        name: "IqOnBlock",
        condition: "iq[type='set'] block[xmlns='urn:xmpp:blocking']",
        handler: dojo.hitch(this, "onBlock")
        });
    this._session.registerPacketHandler({
        name: "IqOnUnblock",
        condition: "iq[type='set'] unblock[xmlns='urn:xmpp:blocking']",
        handler: dojo.hitch(this, "onUnblock")
        });
    },

    checkAvailability: function(onResponse){
        var props = {
            onComplete: function(queryNode){
                var features = dojo.query("feature", queryNode);
                for (var i in features){
                    if(features[i].getAttribute("var") === "urn:xmpp:blocking"){
                        this.isAvailable = true;
                        break;
                    }
                }
                onResponse(true);
            },  
            onError: function(){
                onResponse(false);
            },
            session: this._session,
            to: this._session.domain
        }
        dojox.xmpp.disco.info(props);
    },

    blocklist: function(onSuccess, onError){
        //summary:
        //          Retrieve the users' current blocklist. onSuccess is called if the blocklist is retrieved successfully. Otherwise onError is called
        //iq stanza:
        //          <iq type='get' id='blocklist1'>
        //              <blocklist xmlns='urn:xmpp:blocking'/>
        //          </iq>
        var id = this._session.getNextIqId();
        var req = {
            iq: {
                "@type": "get",
                "@id": id,
                blocklist: {
                    "@xmlns": "urn:xmpp:blocking"
                }
            }
        }
        var deferredObj = this._session.dispatchPacket(dojox.xmpp.util.json2xml(req), "iq", id);
        deferredObj.addCallback(function(res){
            if(res.getAttribute("type") === "result"){
                var items = dojo.map(dojo.query("blocklist item", res), function(node){
                    return node.getAttribute("jid");
                });
                onSuccess(items);
            }
            else{
                var err = session.processXmppError(res);
                onError(err);
            }
        });
    }, 
    
    block: function(){
        //summary:
        //          Block a contact(s)
        //description:
        //          It creates an array named ItemList, which contains the element with jid attributes set to the ones that are passed into the function as argument
        //          This array is then used to create the item elements inside the block element.
        //          That way, a variable no of jids to be blocked can be sent in a single stanza.
        //iq stanza:
        //          <iq from='juliet@capulet.com/chamber' type='set' id='block1'>
        //              <block xmlns='urn:xmpp:blocking'>
        //                  <item jid='romeo@montague.net'/>
        //                  <item jid='yanu.g@directi.com'/>
        //              </block>
        //          </iq>
        var itemList = [];
        for(var i = 0; i < arguments.length; i++){
            itemList[i] = {
                "@jid": arguments[i]
            }
        }
        var id = this._session.getNextIqId();
        var req = {
            iq: {
                "@from": dojox.xmpp.util.encodeJid(this._session.fullJid()),
                "@type": "set",
                "@id": id,
                block: {
                    "@xmlns": "urn:xmpp:blocking",
                    item: itemList
                }
            }
        }
        this._session.dispatchPacket(dojox.xmpp.util.json2xml(req), "iq", id);
    },

    unblock: function(){
        //summary:
        //          unblock a contact(s)
        //description:
        //          It creates an array named ItemList, which contains the element with jid attributes set to the ones that are passed into the function as argument
        //          This array is then used to create the item elements inside the block element.
        //          That way, a variable no of jids to be blocked can be sent in a single stanza.
        //iq stanza:
        //          <iq type='set' id='unblock1'>
        //              <unblock xmlns='urn:xmpp:blocking'>
        //                  <item jid='romeo@montague.net'/>
        //              </unblock>
        //          </iq>
        var itemList = [];
        for(var i = 0; i < arguments.length; i++){
            itemList[i] = {
                "@jid": arguments[i]
            }
        }
        var id = this._session.getNextIqId();
        var req = {
            iq: {
                "@from": dojox.xmpp.util.encodeJid(this._session.fullJid()),
                "@type": "set",
                "@id": id,
                unblock: {
                    "@xmlns": "urn:xmpp:blocking",
                    item: itemList
                }
            }
        }
        this._session.dispatchPacket(dojox.xmpp.util.json2xml(req), "iq", id);
    },
    
    onBlock: function(){
        //summary:
        //          This function doesn't do anything by itself, but it is called whenever the client receives a block notification. 
        //          The UI layer should listen to calls made to this function via dojo.connect
    },
    
    onUnblock: function(){
        //summary:
        //          This function doesn't do anything by itself, but it is called whenever the client receives an unblock notification. 
        //          The UI layer should listen to calls made to this function via dojo.connect
    }
});
