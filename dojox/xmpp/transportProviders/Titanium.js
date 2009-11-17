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
        this.timeOut = 1000;
		if(this.socket.onTimeout) {
			
            this.socket.onTimeout(dojo.hitch(this, function() {
				console.log("dojox.xmpp.transportProviders.Titanium: Connection Timed Out");
                this.endSession();
				this.onConnectionTimeOut(
				{
					server: this.server,
					port: this.port
				}
				);
            }));
		}
        
        this.isErrorCall = true;
        
		if(this.socket.onError) {
            this.socket.onError(dojo.hitch(this, function() {
                if(this.isErrorCall){
					console.log("dojox.xmpp.transportProviders.Titanium: Socket error");
                    this.isErrorCall = false;
                    this.onConnectionError();
					this.close();
                }
            }));
		}
        try {
			if (this.socket.connect(this.timeOut)) {
				console.log("Socket successfully connected: domain =" + this.domain + ", server =" + this.server + ", port =" + this.port);
				this.restartStream();
			}
			else {
				console.log("dojox.xmpp.transportProviders.Titanium: Socket failed to connect");
				this.close();
			}
		}catch(e){
			this.onHostNotFound(e);
		}
	},
	
	close: function(reason) {
		
		this.inherited(arguments);
		try{
			if( this.socket && !this.socket.isClosed()){
				this.socket.close();
					
			}
		}catch(ex){
			console.error("Titanium.close:: Socket already closed");
		}
		this.socket = null;
	},
	onHostNotFound: function(args){
		this.inherited(arguments);
	},
	_writeToSocket: function(data) {
		try {
			this.inherited(arguments);
			this.socket.write(data);
		}catch(e){
			
		}
	}
});

dojox.xmpp.transportProviders.Titanium.check = function(props) {
    return !!window.Titanium;
};