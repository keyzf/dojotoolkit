dojo.provide("dojox.xmpp.transportProviders.Titanium");

dojo.require("dojox.xmpp.transportProviders._base.SocketTransportProvider");
dojo.require("dojox.xmpp.SaxStreamReader");

dojo.declare("dojox.xmpp.transportProviders.Titanium", [dojox.xmpp.transportProviders._base.SocketTransportProvider], {
	_streamReader: null,
    _matchTypeIdAttribute: [],
    _deferredRequests: {},
	
	constructor: function(config) {
		console.log("Using dojox.xmpp.transportProviders.Titanium as transport.");
	},
	
	open: function() {
		this.inherited(arguments);
        
        this.socket = Titanium.Network.createTCPSocket(this.server, this.port);
        this.socket.onRead(dojo.hitch(this._streamReader, "parse"));
        
		if(this.socket.onTimeout) {
			console.log("dojox.xmpp.transportProviders.Titanium: Connection Timed out");
            this.socket.onTimeout(dojo.hitch(this, function() {
                this.endSession();
            }));
		}
        
        this.isErrorCall = true;
        
		if(this.socket.onError) {
            this.socket.onError(dojo.hitch(this, function() {
                if(this.isErrorCall){
					console.log("dojox.xmpp.transportProviders.Titanium: Socket error");
                    this.isErrorCall = false;
                    this.onConnectionError();
                }
            }));
		}
        
        if(this.socket.connect()) {
            console.log("Socket successfully connected: domain =" + this.domain + ", server =" + this.server + ", port =" + this.port );
            this.restartStream();
        } else {
            console.log("Titanium.Network socket failed to connect");
            this.close();
        }
	},
	
	close: function(reason) {
		
		this.inherited(arguments);
		try{
			if(!this.socket.isClosed()){
				this.socket.close();	
			}
		}catch(ex){
			console.log("Titanium.close:: Socket already closed");
		}
		this.socket = null;
	},
	
	_writeToSocket: function(data) {
		this.inherited(arguments);
        this.socket.write(data);
	}
});

dojox.xmpp.transportProviders.Titanium.check = function(props) {
    return !!window.Titanium;
};