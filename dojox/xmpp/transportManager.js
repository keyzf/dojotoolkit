dojo.provide("dojox.xmpp.transportManager");

dojo.require("dojo.AdapterRegistry");

dojox.xmpp.transportManager = new function() {
	var adapterRegistry = new dojo.AdapterRegistry();
	var transport = null;
	
	this.register = function(name, check, transportClass, highPriority) {
		adapterRegistry.register(name, check, transportClass, true, highPriority);
	}
	
	this.getTransport = function(config) {
		if(!transport) {
			if(!config || !dojo.isObject(config)) {
				throw new Error("Need a configuration object to decide what transport to use and to instantiate it.")
			}
			try {
				transport = new (adapterRegistry.match(config))(config);
			} catch(e) {
				throw new Error("No suitable transport found.");
			}
		}
		
		return transport;
	}
};

dojo.require("dojox.xmpp.transportProviders.Titanium");