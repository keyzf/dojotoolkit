dojo.provide("dojox.xmpp.transportProviders.Titanium");

dojo.require("dojox.xmpp.transportProviders._base.SocketTransportProvider");
dojo.require("dojox.xmpp.SaxStreamReader");

dojo.declare("dojox.xmpp.transportProviders.Titanium", [dojox.xmpp.transportProviders._base.SocketTransportProvider], {
	_streamReader: null,
    _matchTypeIdAttribute: [],
    _deferredRequests: {},
	CONSTANTS: {ERROR: -1, CLOSED: 0, OPEN: 1},
	
	constructor: function(config) {
		console.log("Using dojox.xmpp.transportProviders.Titanium as transport.");
		this._socketState = this.CONSTANTS.CLOSED;
	},
	
	open: function() {
		this.inherited(arguments);
        this.timeOut = 1000;
		this.isErrorCall = true;
		
        this.socket = Titanium.Network.createTCPSocket(this.server, this.port);
		
		this.socket.onRead(dojo.hitch(this, function(data){
			try {
				this._streamReader.parse(data);
			}catch(e){
				console.error("socket.onRead: ", e);
			}
		}));
		if (this.socket.onTimeout) {
			this.socket.onTimeout(dojo.hitch(this, function(e){
				console.log("dojox.xmpp.transportProviders.Titanium: Connection Timed Out");
				this.close(e, "onConnectionTimeOut", true);
			}));
			
		}
        
        if (this.socket.onError) {
			// gets called when connection is reset by peer/ connection is lost
			// show that your connection has been disconnected on this error
			this.socket.onError(dojo.hitch(this, function(e){
				if (this.isErrorCall) {
					this.isErrorCall = false;
					this.close(e, "onConnectionReset", true);
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
				this._socketState = this.CONSTANTS.OPEN;
				this.restartStream();
				console.log("Socket successfully connected: domain =" + this.domain + ", server =" + this.server + ", port =" + this.port);
			}
			else {
				console.log("dojox.xmpp.transportProviders.Titanium: Socket failed to connect");
				this.close(null, "onUnableToCreateConnection", true);
			}
		}catch(e){
			this.close(e, "onUnableToCreateConnection", true);
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
	},
	onConnectionReset: function(reason){
		var data = {
			reason:reason,
			domain:this.domain,
			server:this.server,
			port: this.port
		};
		this.inherited(arguments,[data]);
	},
	
	onConnectionTimedOut: function(args){
		this.inherited(args);
	},
	
	close: function(reason, /*String*/callback, /*Boolean*/isError) {
		if(isError){
			this._socketState = this.CONSTANTS.ERROR;
		}
		try{
			if( this.socket && !this.socket.isClosed()){
				this.socket.close();
				this._socketState = this.CONSTANTS.CLOSED;
			}
		}catch(ex){
			console.error("Titanium: close: ", ex);
		}
		this.socket = null;
		this.inherited(arguments);
	},
	
	_writeToSocket: function(data) {
		if(this._socketState != this.CONSTANTS.OPEN){
			return;
		}
		try {
			this.inherited(arguments);
			this.socket.write(data);
		}catch(e){
			this.close(e, "onConnectionReset", true)
			console.error('Titanium:_writeToSocket: ', e);
		}
	}
});

dojox.xmpp.transportProviders.Titanium.check = function(props) {
    return !!window.Titanium;
};