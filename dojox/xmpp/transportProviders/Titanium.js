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
			console.debug("Socket successfully connected: domain =" + this.domain + ", server =" + this.server + ", port =" + this.port);
		}));

		this.socket.onRead(dojo.hitch(this, function(data){
			try {
				this._streamReader.parse(data);
			}catch(e){
				console.error("socket.onRead: ", e);
			}
		}));
		
		this.socket.onReadComplete(dojo.hitch(this, function(){
			if (this._socketState === this.CONSTANTS.OPEN) {
				this.close('onReadComplete', {isError: true, args: dojox.xmpp.consts.TRANSPORT_ERROR}); // need to see if onReadComplete callback expects a param
			}
		}));
		
		if (this.socket.onTimeout) {
			this.socket.onTimeout(dojo.hitch(this, function(e){
				this.close(e,{isError: true, args: dojox.xmpp.consts.TRANSPORT_ERROR}); // need to see if onTimeout callback expects a param
			}));
		}
        
        if (this.socket.onError) {
			this.socket.onError(dojo.hitch(this, function(e){
				if (this._socketState === this.CONSTANTS.OPEN) {
					this.close(e, {isError: true, args: dojox.xmpp.consts.TRANSPORT_ERROR});
				}else{
					this.close(e, {isError: true, args: dojox.xmpp.consts.TRANSPORT_ERROR});
				}
			}));
		}

		this._connectSocket();

	},
	_connectSocket: function(){
		if (!this.socket.isClosed()) {
			this.socket.close();
			this._socketState = this.CONSTANTS.CLOSED;
		}
		try {
			if (this.socket.connectNB()) {
				console.debug('Attempting to connect');
			}else {
				this.close("socket failed to connect", {isError: true, args: dojox.xmpp.consts.TRANSPORT_ERROR});
			}
		}catch(e){
			this.close(e,{isError: true, args: dojox.xmpp.consts.TRANSPORT_ERROR});
		}
	},

	
	close: function(/*String*/reason, errorParams) {
		if(errorParams.isError===true){
			this._socketState = this.CONSTANTS.ERROR;
		}
		try{
			if( this.socket){
				this.socket.close();
			}
			this._socketState = this.CONSTANTS.CLOSED;
		}catch(ex){
			console.error("Titanium: close: ", ex);
		}
		this.socket = null;
		this.inherited(arguments);
		console.debug('Titanium: close: '+reason);
	},
	
	_writeToSocket: function(data) {
		if(this._socketState != this.CONSTANTS.OPEN){
			return;
		}
		try {
			this.inherited(arguments);
			this.socket.write(data);
		}catch(e){
			this.close("Write error", {isError: true, args: dojox.xmpp.consts.TRANSPORT_ERROR});
			console.error('Titanium:_writeToSocket: ', e);
		}
	}

});

dojox.xmpp.transportProviders.Titanium.check = function(props) {
    return !!window.Titanium;
};