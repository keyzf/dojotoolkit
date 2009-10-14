dojo.provide("dojox.xmpp.transportProviders.BoshScriptTag");

dojo.require("dojox.xmpp.transportProviders._base.BoshTransportProvider");
dojo.require("dojox.xmpp.bosh");

dojo.declare("dojox.xmpp.transportProviders.BoshScriptTag", dojox.xmpp.transportProviders._base.BoshTransportProvider, {
	constructor: function() {},
	
	open: function(){
		this.inherited(arguments);
		
		dojox.xmpp.bosh.initialize({
			iframes: this._hold + 1,
			load: dojo.hitch(this, function(){
				this.onStreamReady();
				this._sendLogin();
			})
		});
	},
	
    _sendXml: function(message, rid){
		this.inherited(arguments);

		return dojox.xmpp.bosh.get({
			rid: rid,
			url: this.serviceUrl + '?' + encodeURIComponent(message),
			error: dojo.hitch(this, function(res, io){
				this.setState("Terminate", "error");
				return false;
			})
		}).addCallback(this, function(res){
            try {
                console.info("RECD: ", (new XMLSerializer()).serializeToString(res));
            } catch(e) {
                console.info("RECD: ", res);
            }
    		return this._processDocument(res, rid);
		});
	}
});

dojox.xmpp.transportManager.register("BoshScriptTag", function(props) {
    return !window.Titanium;
}, dojox.xmpp.transportProviders.BoshScriptTag, true);