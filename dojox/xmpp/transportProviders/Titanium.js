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
        this.timeOut = 1;
        this.socket = Titanium.Network.createTCPSocket(this.server, this.port);
		
		this.socket.onConnect(dojo.hitch(this,function(data){
			this._socketState = this.CONSTANTS.OPEN;
			this.restartStream();
			console.log("Socket successfully connected: domain =" + this.domain + ", server =" + this.server + ", port =" + this.port);
		}));

		this.socket.onRead(dojo.hitch(this, function(data){
			try {
				this._streamReader.parse(data);
			}catch(e){
				console.error("socket.onRead: ", e);
			}
		}));
		
		this.socket.onReadComplete(dojo.hitch(this, function(e){
			console.error('Titanium: onReadComplete');
			this.close(e,'onReadComplete',true); // need to see if onReadComplete callback expects a param
		}));
		
		if (this.socket.onTimeout) {
			this.socket.onTimeout(dojo.hitch(this, function(e){
				console.error("dojox.xmpp.transportProviders.Titanium: Connection Timed Out");
				this.close(e,'onConnectionTimeOut',true); // need to see if onTimeout callback expects a param
			}));
		}
        
        if (this.socket.onError) {
			this.socket.onError(dojo.hitch(this, function(e){
				if (this._socketState === this.CONSTANTS.OPEN) {
					this.close(e, 'onConnectionReset', true);
				}else{
					this.close(e,'onHostNotFound', true);
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
			if (this.socket.connectNB()) {
				console.log('Attempting to connect');
			}else {
				console.log("dojox.xmpp.transportProviders.Titanium: Socket failed to connect");
				this.close(null, "onUnableToCreateConnection", true);
			}
		}catch(e){
			
			this.close(e,'onHostNotFound',true);
		}
	},

	
	close: function(reason, /*String*/callback, /*Boolean*/isError) {
		if(isError){
			this._socketState = this.CONSTANTS.ERROR;
		}
		try{
			if( this.socket){
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
	},
	
/// ALL SOCKET RELATED ERRORS ARE LISTED HERE
	
	onHostNotFound: function(reason){
		this.inherited(arguments);
	},
	
	onConnectionReset: function(reason){
		this.inherited(arguments);
	},
	
	onConnectionTimeOut: function(args){
		this.inherited(arguments);
	},
	
	onReadComplete: function(args){
		this.inherited(arguments);
	}
});

dojox.xmpp.transportProviders.Titanium.check = function(props) {
    return !!window.Titanium;
};