dojo.provide("dojox.xmpp.transportProviders.BoshXhr");

dojo.require("dojox.xmpp.transportProviders._base.BoshTransportProvider");
dojo.require("dojox.xmpp.transportManager");

dojo.declare("dojox.xmpp.transportProviders.BoshXhr", dojox.xmpp.transportProviders._base.BoshTransportProvider, {
	open: function() {
		this.inherited(arguments);
		this._sendLogin();
	},
	
	_sendXml: function(message, rid){
		this.inherited(arguments);
		
		return dojo.rawXhrPost({
			contentType: "text/xml",
			url: this.serviceUrl,
			postData: message,
			handleAs: "xml",
			error: dojo.hitch(this, function(res, io){
				return this._processError(io.xhr.responseXML, io.xhr.status, rid);
			})
		}).addCallback(this, function(res){
			try {
				console.info("RECD: ", (new XMLSerializer()).serializeToString(res));
			} catch(e) {
				console.info("RECD: ", res);
			}
    		return this.processDocument(res, rid);
		});
	}
});

dojox.xmpp.transportManager.register("BoshXhr", function(props) {
	// FIXME: This is wrong. This always returns false.
    return !!props.bindUrl;
}, dojox.xmpp.transportProviders.BoshXhr, true);