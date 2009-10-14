dojo.provide("dojox.xmpp.transportManager");

dojo.require("dojo.AdapterRegistry");
dojo.require("dojox.xmpp.transportProviders.Titanium");
dojo.require("dojox.xmpp.transportProviders.BoshXhr");
dojo.require("dojox.xmpp.transportProviders.BoshScriptTag");

dojox.xmpp.transportManager = new function() {
	var adapterRegistry = new dojo.AdapterRegistry();
	var transport = null;

	this.register = function(name, check, transportClass, highPriority) {
		adapterRegistry.register(name, check, transportClass, true, highPriority);
	}
	
    dojo.forEach(["Titanium", "BoshXhr", "BoshScriptTag"], dojo.hitch(this, function(transportName) {
        var transportClass = dojo.getObject("dojox.xmpp.transportProviders." + transportName);
        
        if(transportClass && transportClass.check) {
            this.register(transportName, transportClass.check, transportClass);               
        }
    }));
    
	this.getNewTransportInstance = function(config) {
		if(!config || !dojo.isObject(config)) {
			throw new Error("Need a configuration object to decide what transport to use and to instantiate it.")
		}
		
		console.log(config);
		
		try {
			return new (adapterRegistry.match(config))(config);
		} catch(e) {
			console.log(e);
			throw new Error("No suitable transport found.");
		}
	}
};