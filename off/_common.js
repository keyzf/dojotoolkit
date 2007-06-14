dojo.provide("dojox.off._common");

dojo.require("dojox.storage.GearsStorageProvider");
dojo.require("dojox.sql");
dojo.require("dojox.off.sync");

// Author: Brad Neuberg, bkn3@columbia.edu, http://codinginparadise.org

// summary:
//		dojox.off is the main object for offline applications.
dojo.mixin(dojox.off, {
	// NETWORK_CHECK: int
	//		Time in seconds on how often we should check the status of the
	//		network with an automatic background timer. Defaults to 5.
	NETWORK_CHECK: 5,
	
	// STORAGE_NAMESPACE: String
	//		The namespace we use to save core data into Dojo Storage.
	STORAGE_NAMESPACE: "dojo_offline",
	
	// enabled: boolean
	//		Whether offline ability is enabled or not. Defaults to true.
	enabled: true,

	// isOnline: boolean
	//	true if we are online, false if not
	isOnline: false,
	
	// availabilityURL: String
	//		The URL to check for site availability.  We do a GET request on
	//		this URL to check for site availability.  By default we check for a
	//		simple text file in src/off/network_check.txt that has one value
	//		it, the value '1'.
	availabilityURL: dojo.moduleUrl("dojox", "off/network_check.txt"),
	
	// goingOnline: boolean
	//		True if we are attempting to go online, false otherwise
	goingOnline: false,
	
	// coreOperationFailed: boolean
	//		A flag set by the Dojo Offline framework that indicates that the
	//		user denied some operation that required the offline cache or an
	//		operation failed in some critical way that was unrecoverable. For
	//		example, if the offline cache is Google Gears and we try to get a
	//		Gears database, a popup window appears asking the user whether they
	//		will approve or deny this request. If the user denies the request,
	//		and we are doing some operation that is core to Dojo Offline, then
	//		we set this flag to 'true'.  This flag causes a 'fail fast'
	//		condition, turning off offline ability.
	coreOperationFailed: false,
	
	// doNetworkChecking: boolean
	//		Whether to have a timing interval in the background doing automatic
	//		network checks at regular intervals; the length of time between
	//		checks is controlled by dojo.xoff.NETWORK_CHECK. Defaults to true.
	doNetworkChecking: true,
	
	// hasOfflineCache: boolean
	//  	Determines if an offline cache is available or installed; an
	//  	offline cache is a facility that can truely cache offline
	//  	resources, such as JavaScript, HTML, etc. in such a way that they
	//  	won't be removed from the cache inappropriately like a browser
	//  	cache would. If this is false then an offline cache will be
	//  	installed. Only Google Gears is currently supported as an offline
	//  	cache. Future possible offline caches include Firefox 3.
	hasOfflineCache: null,
	
	// browserRestart: boolean
	//		If true, the browser must be restarted to register the existence of
	//		a new host added offline (from a call to addHostOffline); if false,
	//		then nothing is needed.
	browserRestart: false,
	
	_onLoadListeners: [],
	_initializeCalled: false,
	_storageLoaded: false,
	_pageLoaded: false,
	
	onOnline: function(){ /* void */
		// summary:
		//		Called when we go online.
		// description:
		//		This method is called when we are successfully online. The
		//		default implementation is to perform a synchronization.
		//		Override with your own implementation if you don't want the
		//		default behavior
		console.debug("online");
		// dojox.off.isOnline = true;
	},
	
	onOffline: function(){ /* void */
		// summary:
		//		Called when we go offline.
		// description: 
		//		This method is called when we move offline.
		console.debug("offline");
	},
	
	goOffline: function(){ /* void */
		// summary:
		//		Manually goes offline, away from the network.
		if((dojox.off.sync.isSyncing == true)||(this.goingOnline == true)){
			return;
		}
		
		this.goingOnline = false;
		this.isOnline = false;
	},
	
	goOnline: function(finishedCallback){ /* void */
		// summary: Attempts to go online.
		// description:
		//		Attempts to go online, making sure this web application's web
		//		site is available. 'callback' is called asychronously with the
		//		result of whether we were able to go online or not.
		// finishedCallback: Function
		//		An optional callback function that will receive one argument:
		//		whether the site is available or not and is boolean. If this
		//		function is not present we call dojo.xoff.onOnline instead if
		//		we are able to go online.
		
		//console.debug("goOnline");
		
		if(dojox.off.sync.isSyncing || dojox.off.goingOnline){
			return;
		}
		
		this.goingOnline = true;
		this.isOnline = false;
		
		// see if can reach our web application's web site
		this._isSiteAvailable(finishedCallback);
	},
	
	addOnLoad: function(func){ /* void */
		// summary:
		//		Adds an onload listener to know when Dojo Offline can be used.
		// description:
		//		Adds a listener to know when Dojo Offline can be used. This
		//		ensures that the Dojo Offline framework is loaded, that the
		//		local Dojo Storage system is ready to be used, and that the
		//		page is finished loading. 
		// func: Function
		//		A function to call when Dojo Offline is ready to go
		this._onLoadListeners.push(func);
	},
	
	removeOnLoad: function(func){ /* void */
		// summary: Removes the given onLoad listener
		for(var i = 0; i < this._onLoadListeners.length; i++){
			if(func == this._onLoadListeners[i]){
				this._onLoadListeners = this._onLoadListeners.splice(i, 1);
				break;
			}
		}
	},
	
	save: function(){ /* void */
		// summary:
		//		Causes the Dojo Offline framework to save its configuration
		//		data into local storage.	
	},
	
	load: function(finishedCallback /* Function */){ /* void */
		// summary:
		//		Causes the Dojo Offline framework to load its configuration
		//		data from local storage
		dojox.off.sync.load(finishedCallback);
	},
	
	initialize: function(){ /* void */
		// summary:
		//		Called when a Dojo Offline-enabled application is finished
		//		configuring Dojo Offline, and is ready for Dojo Offline to
		//		initialize itself.
		// description:
		//		When an application has finished filling out the variables Dojo
		//		Offline needs to work, such as dojox.off.ui.appName, it should
		//		call this method to tell Dojo Offline to initialize itself.
		//		This method is needed for a rare edge case. In some conditions,
		//		especially if we are dealing with a compressed Dojo build, the
		//		entire Dojo Offline subsystem might initialize itself and be
		//		running even before the JavaScript for an application has had a
		//		chance to run and configure Dojo Offline, causing Dojo Offline
		//		to have incorrect initialization parameters for a given app,
		//		such as no value for dojox.off.ui.appName. This method is
		//		provided to prevent this scenario, to slightly 'slow down' Dojo
		//		Offline so it can be configured before running off and doing
		//		its thing.	

		//console.debug("dojox.off.initialize");
		this._initializeCalled = true;
		
		if(this._storageLoaded && this._pageLoaded){
			this._onLoad();
		}
	},
	
	onSave: function(isCoreSave, status, key, value, namespace){
		//console.debug("onSave, isCoreSave="+isCoreSave+", status="+status+", key="+key+", value="+value);
		// summary:
		//		A standard function that can be registered which is called when
		//		some piece of data is saved locally.
		// description:
		//		Applications can override this method to be notified when
		//		offline data is attempting to be saved. This can be used to
		//		provide UI feedback while saving, and for providing appropriate
		//		error feedback if saving fails due to a user not allowing the
		//		save to occur.
		// isCoreSave: boolean
		//		If true, then this save was for a core piece of data necessary
		//		for the functioning of Dojo Offline. If false, then it is a
		//		piece of normal data being saved for offline access. Dojo
		//		Offline will 'fail fast' if some core piece of data could not
		//		be saved, automatically setting dojox.off.coreOperationFailed to
		//		'true' and dojox.off.enabled to 'false'.
		// status: dojox.storage.SUCCESS, dojox.storage.PENDING, dojox.storage.FAILED
		//		Whether the save succeeded, whether it is pending based on a UI
		//		dialog asking the user for permission, or whether it failed.
		// key: String
		//		The key that we are attempting to persist
		// value: Object
		//		The object we are trying to persist
		// namespace: String
		//		The Dojo Storage namespace we are saving this key/value pair
		//		into, such as "default", "Documents", "Contacts", etc.
		//		Optional.
		if(isCoreSave && (status == dojox.storage.FAILED)){
			dojox.off.coreOperationFailed = true;
			dojox.off.enabledabled = false;
			
			// FIXME: Stop the background network thread
			dojox.off.onCoreOperationFailed();
		}
	},
	
	onOfflineCacheInstalled: function(){
		// summary:
		//		A function that can be overridden that is called when a user
		//		has installed the offline cache after the page has been loaded.
		//		If a user didn't have an offline cache when the page loaded, a
		//		UI of some kind might have prompted them to download one. This
		//		method is called if they have downloaded and installed an
		//		offline cache so a UI can reinitialize itself to begin using
		//		this offline cache.
	},
	
	onCoreOperationFailed: function(){
		// summary:
		//		Called when a core operation during interaction with the
		//		offline cache is denied by the user. Some offline caches, such
		//		as Google Gears, prompts the user to approve or deny caching
		//		files, using the database, and more. If the user denies a
		//		request that is core to Dojo Offline's operation, we set
		//		dojox.off.coreOperationFailed to true and call this method for
		//		listeners that would like to respond some how to Dojo Offline
		//		'failing fast'.
	},
	
	standardSaveHandler: function(status, isCoreSave, dataStore, item){
		// summary:
		//		Called by portions of the Dojo Offline framework as a standard
		//		way to handle local save's; this method is 'package private'
		//		and should not be used outside of the Dojo Offline package.
		if((status == dojox.storage.FAILED) && isCoreSave){
			this.coreOperationFailed = true;
			this.enabled = false;	
		}
		
		if(this.onSave){
			this.onSave(status, isCoreSave, dataStore, item);
		}
	},
	
	_checkOfflineCacheAvailable: function(finishedCallback){
		// is a true, offline cache running on this machine?
		this.hasOfflineCache = dojo.isGears;
		
		finishedCallback();
	},
	
	_onLoad: function(){
		//console.debug("dojox.off._onLoad");
		// both local storage and the page are finished loading
		
		// cache the Dojo JavaScript -- just use the default dojo.js
		// name for the most common scenario
		// FIXME: TEST: Make sure syncing doesn't break if dojo.js
		// can't be found, or report an error to developer
		dojox.off.files.cache(dojo.moduleUrl("dojo", "dojo.js"));
		
		// pull in the files needed by Dojo
		this._cacheDojoResources();
		
		// FIXME: need to pull in the firebug lite files here!
		// workaround or else we will get an error on page load
		// from Dojo that it can't find 'console.debug' for optimized builds
		// dojox.off.files.cache(djConfig.baseRelativePath + "src/debug.js");
		
		// make sure that resources needed by all of our underlying
		// Dojo Storage storage providers will be available
		// offline
		dojox.off.files.cache(dojox.storage.manager.getResourceList());
		
		// see if we have an offline cache; when done, move
		// on to the rest of our startup tasks
		this._checkOfflineCacheAvailable(dojo.hitch(this, "_onOfflineCacheChecked"));
	},
	
	_onOfflineCacheChecked: function(){
		// this method is part of our _onLoad series of startup tasks
		
		// if we have an offline cache, see if we have been added to the 
		// list of available offline web apps yet
		if(this.hasOfflineCache == true && this.enabled == true){
			// load framework data; when we are finished, continue
			// initializing ourselves
			this.load(dojo.hitch(this, "_finishStartingUp"));
		}else if(this.hasOfflineCache == true && this.enabled == false){
			// we have an offline cache, but it is disabled for some reason
			// perhaps due to the user denying a core operation
			this._finishStartingUp();
		}else{
			this._keepCheckingUntilInstalled();
		}
	},
	
	_keepCheckingUntilInstalled: function(){
		// this method is part of our _onLoad series of startup tasks
		
		// kick off a background interval that keeps
		// checking to see if an offline cache has been
		// installed since this page loaded
			
		// FIXME: Gears: See if we are installed somehow after the
		// page has been loaded
		
		// now continue starting up
		this._finishStartingUp();
	},
	
	_finishStartingUp: function(){
		//console.debug("dojox.off._finishStartingUp");
		// this method is part of our _onLoad series of startup tasks
		
		if(this.enabled){
			// kick off a thread to check network status on
			// a regular basis
			this._startNetworkThread();

			// try to go online
			this.goOnline(dojo.hitch(this, function(){
				// indicate we are ready to be used
				for(var i = 0; i < this._onLoadListeners.length; i++){
					this._onLoadListeners[i]();
				}
			}));
		}else{ // we are disabled or a core operation failed
			if(this.coreOperationFailed == true){
				this.onCoreOperationFailed();
			}else{
				for(var i = 0; i < this._onLoadListeners.length; i++){
					this._onLoadListeners[i]();
				}
			}
		}
	},
	
	_onPageLoad: function(){
		//console.debug("dojox.off._onPageLoad");
		this._pageLoaded = true;
		
		// console.debug(this._initializeCalled);
		if(this._storageLoaded && this._initializeCalled){
			this._onLoad();
		}
	},
	
	_onStorageLoad: function(){
		//console.debug("dojox.off._onStorageLoad");
		this._storageLoaded = true;
		
		// were we able to initialize storage? if
		// not, then this is a core operation, and
		// let's indicate we will need to fail fast
		if(!dojox.storage.manager._initialized){
			this.coreOperationFailed = true;
			this.enabled = false;
		}
		
		// console.debug(this._initializeCalled);
		if(this._pageLoaded && this._initializeCalled){
			this._onLoad();		
		}
	},
	
	_isSiteAvailable: function(finishedCallback){
		// summary:
		//		Determines if our web application's website is available.
		// description:
		//		This method will asychronously determine if our web
		//		application's web site is available, which is a good proxy for
		//		network availability. The URL dojox.off.availabilityURL is
		//		used, which defaults to this site's domain name (ex:
		//		foobar.com). We check for dojox.off.AVAILABILITY_TIMEOUT (in
		//		seconds) and abort after that
		// finishedCallback: Function
		//		An optional callback function that will receive one argument:
		//		whether the site is available or not and is boolean. If this
		//		function is not present we call dojox.off.onOnline instead if we
		//		are able to go online.
		var args = {
			url:		dojox.off._getAvailabilityURL(),
			handleAs:	"text",
			error:		function(err){
				//console.debug("dojox.off._isSiteAvailable.error: " + err);
				dojox.off.goingOnline = false;
				dojox.off.isOnline = false;
				if(finishedCallback){
					finishedCallback(false);
				}
			},
			load:		function(data){
				//console.debug("dojox.off._isSiteAvailable.load, data="+data);	
				dojox.off.goingOnline = false;
				dojox.off.isOnline = true;
				
				if(finishedCallback){
					finishedCallback(true);
				}else if(dojox.off.onOnline){
					dojox.off.onOnline();
				}
			}
		};
		dojo.xhrGet(args);
	},
	
	_startNetworkThread: function(){
		console.debug("startNetworkThread");
		
		// kick off a thread that does periodic
		// checks on the status of the network
		if(this.doNetworkChecking == false){
			return;
		}

		window.setInterval(function(){
			var args = {
				url:	 	dojox.off._getAvailabilityURL(),
				sync:		false,
				handleAs:	"text",
				error:		function(err){
					if(dojox.off.isOnline){
						dojox.off.isOnline = false;
						dojox.off.onOffline();
						console.debug("going offline...");
					}
				},
				load:	function(data){
					if(!dojox.off.isOnline){
						dojox.off.isOnline = true;
						dojox.off.onOnline();
						console.debug("...going online");
					}
				}
			};

			dojo.xhrGet(args);

		}, this.NETWORK_CHECK * 1000);
	},
	
	_getAvailabilityURL: function(){
		var url = this.availabilityURL.toString();
		
		// bust the browser's cache to make sure we are really talking to
		// the server
		if(url.indexOf("?") == -1){
			url += "?";
		}else{
			url += "&";
		}
		url += "browserbust=" + new Date().getTime();
		
		return url;
	},
	
	_onOfflineCacheInstalled: function(){
		if(this.onOfflineCacheInstalled){
			this.onOfflineCacheInstalled();
		}
	},
	
	_cacheDojoResources: function(){
		// if we are debugging, then the core Dojo bootstrap
		// system was loaded as separate JavaScript files;
		// add these to our offline cache list. these are
		// loaded before the dojo.require() system exists
		if(djConfig.isDebug){
			dojox.off.files.cache(dojo.moduleUrl("dojo", "_base.js").uri);
			dojox.off.files.cache(dojo.moduleUrl("dojo", "_base/_loader/loader.js").uri);
			dojox.off.files.cache(dojo.moduleUrl("dojo", "_base/_loader/bootstrap.js").uri);
			
			// FIXME: pull in the host environment file in a more generic way
			// for other host environments
			dojox.off.files.cache(dojo.moduleUrl("dojo", "_base/_loader/hostenv_browser.js").uri);
		}
		
		// in _base/_loader/loader.js, in the function dojo._loadUri, we added
		// code to capture any uris that were loaded for dojo packages with
		// calls to dojo.require() so we can add them to our list of captured
		// files here

		// grab the rest of the bootstraps just in case we're not being loaded through a build
		dojox.off.files.cache(dojo.moduleUrl("dojo", "_base/_loader/bootstrap.js"));
		dojox.off.files.cache(dojo.moduleUrl("dojo", "_base/_loader/loader.js"));
		dojox.off.files.cache(dojo.moduleUrl("dojo", "_base/_loader/hostenv_browser.js"));
		dojox.off.files.cache(dojo.moduleUrl("dojo", "_base.js"));

		if(dojo._loadedUrls.length){
			// pre-populate w/ loaded URLs to date
			dojox.off.files.cache(dojo._loadedUrls);
		}

		// and make sure that should new URLs be loaded in the future that we grab them too
		dojo.connect(dojo._loadedUrls, "push", dojox.off.files, "cache");
	}
});


// wait until the storage system is finished loading
dojox.storage.manager.addOnLoad(dojo.hitch(dojox.off, "_onStorageLoad"));

// wait until the page is finished loading
dojo.addOnLoad(dojox.off, "_onPageLoad");
