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
        this.timeOut = 1000;
		this.isErrorCall = true;
		
        this.socket = Titanium.Network.createTCPSocket(this.server, this.port);
		
        this.socket.onRead(dojo.hitch(this._streamReader, "parse"));
		
		if (this.socket.onTimeout) {
			this.socket.onTimeout(dojo.hitch(this, function(){
				console.log("dojox.xmpp.transportProviders.Titanium: Connection Timed Out");
				this.onConnectionTimeOut();
			}));
			
		}
        
        if (this.socket.onError) {
			// gets called when connection is reset by peer/ connection is lost
			// show that your connection has been disconnected on this error
			this.socket.onError(dojo.hitch(this, function(e){
				if (this.isErrorCall) {
					this.isErrorCall = false;
					this.onConnectionReset(e);
					this.close();
				}
			}));
		}

		this._connectSocket();

	},
	_connectSocket: function(){
		if (!this.socket.isClosed()) {
			this.socket.close();
		}
		try {
			if (this.socket.connect(this.timeOut)) {
				this.restartStream();
				console.log("Socket successfully connected: domain =" + this.domain + ", server =" + this.server + ", port =" + this.port);
			}
			else {
				console.log("dojox.xmpp.transportProviders.Titanium: Socket failed to connect");
				this.close();
			}
		}catch(e){
			this.onUnableToCreateConnection(e);
		}
	},
	onUnableToCreateConnection: function(reason){
		var data = {
			reason: reason,
			domain: this.domain,
			server: this.server,
			port: this.port
		};
		this.inherited(arguments,[data]);
		this.close();
	},
	onConnectionReset: function(reason){
		var data = {
			reason:reason,
			domain:this.domain,
			server:this.server,
			port: this.port
		};
		this.inherited(arguments,[data]);
		this.close();
	},
	
	onConnectionTimedOut: function(args){
		this.inherited(args);
		this.close();
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
	
	_writeToSocket: function(data) {
		try {
			this.inherited(arguments);
			this.socket.write(data);
		}catch(e){
			console.error('Write to socket error: '+e);
		}
	}
});

dojox.xmpp.transportProviders.Titanium.check = function(props) {
    return !!window.Titanium;
};