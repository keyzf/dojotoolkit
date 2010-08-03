dojo.provide("dojox.xmpp.transportProviders.BoshXhr");

dojo.require("dojox.xmpp.transportProviders._base.BoshTransportProvider");

dojo.declare("dojox.xmpp.transportProviders.BoshXhr", dojox.xmpp.transportProviders._base.BoshTransportProvider, {
	open: function() {
		this.inherited(arguments);
		this.onStreamReady();
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
			return this._processDocument(res, rid);
		});
	}
});

dojox.xmpp.transportProviders.BoshXhr.check = function(props) {
    // FIXME: This is wrong. This always returns false.
    return !!props.bindUrl;
};