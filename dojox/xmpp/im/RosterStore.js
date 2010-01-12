dojo.provide("dojox.xmpp.im.RosterStore");

dojo.require("dojo.data.util.filter");
dojo.require("dojo.data.util.simpleFetch");

dojo.require("dojox.xmpp.util");

dojo.declare("dojox.xmpp.im.RosterStore", null, {
    // summary:
    //     The RosterStore implements the dojo.data.api.Read API and reads
    //     data from xmppSession.roster array
    //
    
    // CONSTANTS: all member constants are declared under this object
    CONSTANTS: {
        // CONSTANTS.DEFAULT_GROUP_NAME: Roster items that have no groups are added to this group
        DEFAULT_GROUP_NAME: "Unfiled Contacts",
		
		presence: {
		    UPDATE: 201,
		    SUBSCRIPTION_REQUEST: 202,
		//  SUBSCRIPTION_REQUEST_PENDING: 203,
		    /* used when 'ask' attribute is absent on a roster item */
		    SUBSCRIPTION_SUBSTATUS_NONE: 204,
		
		    SUBSCRIPTION_NONE: 'none',
		    SUBSCRIPTION_FROM: 'from',
		    SUBSCRIPTION_TO: 'to',
		    SUBSCRIPTION_BOTH: 'both',
		    SUBSCRIPTION_REQUEST_PENDING: 'pending',
		
		    STATUS_ONLINE: 'online',
		    STATUS_AWAY: 'away',
		    STATUS_CHAT: 'chat',
		    STATUS_DND: 'dnd',
		    STATUS_EXTENDED_AWAY: 'xa',
		    STATUS_OFFLINE: 'offline',
		    
		    STATUS_INVISIBLE: 'invisible'
		}
    },
    constructor: function(session){
        // summary: constructor
        this._roster = {};
        this._groups = {};
		this._tempPresence = {};  // For temporarily storing presence information, incase the roster isn't available yet.
		this._session = session;
        this._features = {
            'dojo.data.api.Read': true,
            'dojo.data.api.Notification': true,
            'dojo.data.api.Identity': true,
			"dojo.data.api.Write": true
        };
		
		session.registerPacketHandler({
			name: "ChatPresenceUpdate",
			//condition: "presence:not([type]):not(x[xmlns^='http://jabber.org/protocol/muc']), presence[type='unavailable']:not(x[xmlns^='http://jabber.org/protocol/muc'])",
			condition: function(msg) {
				if(msg.nodeName === "presence") {
					var xNodes = msg.getElementsByTagName("x"); 
					if(xNodes.length && dojo.some(xNodes, function(node) {
						return node.getAttribute("xmlns").indexOf("http://jabber.org/protocol/muc") === 0;
					})) {
						return false;
					}
					if(!msg.getAttribute("type") || msg.getAttribute("type") == "unavailable") {
						return true;
					}
				}
				
				return false;
			},
			handler: dojo.hitch(this, this._presenceUpdateHandler)
		});
		
        dojo.connect(session, "onRosterAdded", this, function(buddy){
            var buddyItem = this._createBuddyItem(buddy);
            this._rosterAdded(buddyItem);
        });
    },
    startup: function(){
        //pw.subscribe("/pw/desktop/kernel", this, this._processKernelEvent);
        //this._connectToActiveSession();
    },
    _processKernelEvent: function(/* Object */msg){
        // summary:
        //     This function is called when the /pw/desktop/kernel topic is published
        // msg:
        //     the message object published with the /pw/desktop/kernel topic
        if (msg) {
            if (msg.reconnected) {
                this._resetRoster();
                this._connectToActiveSession();
            }
            else {
                if (msg.connectionError) {
                    // this._resetAllPresence();
                }
            }
        }
    },
    getOfflinePresence: function(jid){
        var presence = {
            from: jid,
            show: "offline",
            status: ""
        };
        return presence;
    },
    _resetAllPresence: function(){
        // summary:
        //     resets the presence to offline for all buddyItems and calls onSet notifications on each of them
        var buddyItem;
        for (var jid in this._roster) {
            buddyItem = this._roster[jid];
            if (buddyItem.presence.show !== "offline" || buddyItem.presence.status !== "") {
                this._updateBuddyPresence(this.getOfflinePresence(jid));
            }
        }
    },
    _resetRoster: function(){
        // summary:
        //     resets all the items in the RosterStore, effectively making it empty
        if (this._roster) {
            for (var jid in this._roster) {
                var buddyItem = this._roster[jid];
                delete this._roster[jid];
                this.onDelete(buddyItem);
            }
        }
        this._roster = {};
        if (this._groups) {
            for (var groupName in this._groups) {
                var groupItem = this._groups[groupName];
                delete this._groups[groupName];
                this.onDelete(groupItem);
            }
        }
        this._groups = {};
    },
    _connectToActiveSession: function(){
        // summary:
        //     connect to the active session for events the store is interested in 
        var session = this._session;
        /*dojo.connect(session, "onRosterAdded", this, function(buddy){
            var buddyItem = this._createBuddyItem(buddy);
            this._rosterAdded(buddyItem);
        });*/
        /*dojo.connect(session, "onRosterChanged", this, function(newCopy, previousCopy){
            var newBuddyItem = this._createBuddyItem(newCopy);
            var previousBuddyItem = this.getBuddyItem(previousCopy);
            this._buddyUpdated(newBuddyItem, previousBuddyItem);
        });*/
        dojo.connect(session, "onRosterRemoved", this, function(buddy){
            var buddyItem = this.getBuddyItem(buddy);
            this._buddyRemoved(buddyItem);
        });
        dojo.connect(session, "onPresenceUpdate", this, this._updateBuddyPresence);
    },
    
    getBuddyItem: function(/* Object || String */buddy){
        // summary:
        //     returns a buddyItem from the roster that maps to the jid of passed object
        // buddy:
        //     object that can be mapped to a buddyItem
        var jid;
        if(typeof buddy == "string") {
            jid = buddy;
        }
        else {
            this._normaliseBuddy(buddy);
            jid = buddy.jid;
        }
        return this._roster[jid] || this._createBuddyItem({
            jid: jid
        });
    },
    getFeatures: function(){
        // summary:
        //     See dojo.data.api.Read.getFeatures()
        return this._features; //Object
    },
    getIdentity: function(/* item */item){
        // summary:
        //     See dojo.data.api.Identity.getIdentity()
        this._assertIsItem(item);
        if (item.rosterNodeType == "contact") {
            return "#contact#" + item.jid;
        }
        else {
            return "#group#" + item.name;
        }
    },
    getLabel: function(/* item */item){
        // summary:
        //     See dojo.data.api.Read.getLabel()
        if (item.rosterNodeType == "contact" && typeof item.name == "undefined") {
            return item.jid.split("@")[0]; //String
        }
        else {
            return item.name.split("@")[0];
        }
    },
    _assertIsItem: function(/* item */item){
        // summary:
        //     This function tests whether the item passed in is indeed an item in the store.
        // item:
        //     The item to test for being contained by the store.
        if (!this.isItem(item)) {
            throw new Error("pw.desktop.roster.RosterStore: Invalid item argument.");
        }
    },
    _assertIsAttribute: function(/* attribute-name-string */attribute){
        // summary:
        //     This function tests whether the item passed in is indeed a valid 'attribute' like type for the store.
        // attribute:
        //     The attribute to test for being contained by the store.
        if (typeof attribute !== "string") {
            throw new Error("pw.desktop.roster.RosterStore: Invalid attribute argument.");
        }
    },
    getValue: function( /* item */item, /* attribute-name-string */ attribute, /* value? */ defaultValue){
        // summary:
        //     See dojo.data.api.Read.getValue()
        var values = this.getValues(item, attribute);
        return (values.length > 0) ? values[0] : defaultValue; // mixed
    },
    getValues: function(/* item */item, /* attribute-name-string */ attribute){
        // summary:
        //     See dojo.data.api.Read.getValues()
        this._assertIsItem(item);
        this._assertIsAttribute(attribute);
        return item[attribute] || []; // Array
    },
    getAttributes: function(/* item */item){
        // summary:
        //     See dojo.data.api.Read.getAttributes()
        this._assertIsItem(item);
        var attributes = [];
        for (var key in item) {
            attributes.push(key);
        }
        return attributes; // Array
    },
    hasAttribute: function( /* item */item, /* attribute-name-string */ attribute){
        // summary:
        //     See dojo.data.api.Read.hasAttribute()
        this._assertIsItem(item);
        this._assertIsAttribute(attribute);
        return (attribute in item);
    },
    containsValue: function(/* item */item, /* attribute-name-string */ attribute, /* anything */ value){
        // summary:
        //     See dojo.data.api.Read.containsValue()
        var regexp = undefined;
        if (typeof value === "string") {
            regexp = dojo.data.util.filter.patternToRegExp(value, false);
        }
        return this._containsValue(item, attribute, value, regexp); //boolean.
    },
    _containsValue: function( /* item */item, /* attribute-name-string */ attribute, /* anything */ value, /* RegExp?*/ regexp){
        // summary:
        //     Internal function for looking at the values contained by the item.
        // description:
        //     Internal function for looking at the values contained by the item.  This
        //     function allows for denoting if the comparison should be case sensitive for
        //     strings or not (for handling filtering cases where string case should not matter)
        // 
        // item:
        //     The data item to examine for attribute values.
        // attribute:
        //     The attribute to inspect.
        // value:
        //     The value to match.
        // regexp:
        //     Optional regular expression generated off value if value was of string type to handle wildcarding.
        //     If present and attribute values are string, then it can be used for comparison instead of 'value'
        return dojo.some(this.getValues(item, attribute), function(possibleValue){
            if (possibleValue !== null && !dojo.isObject(possibleValue) && regexp) {
                if (possibleValue.toString().match(regexp)) {
                    return true; // Boolean
                }
            }
            else 
                if (value === possibleValue) {
                    return true; // Boolean
                }
        });
    },
    isItem: function(/* anything */something){
        // summary:
        //     See dojo.data.api.Read.isItem()
        var isItem = (something &&
        ((something.rosterNodeType === "group" && typeof something.name == "string") ||
        (something.rosterNodeType === "contact" && typeof something.jid == "string")));
        return isItem; // Boolean
    },
    isItemLoaded: function(/* anything */something){
        // summary:
        //     See dojo.data.api.Read.isItemLoaded()
        return this.isItem(something); //boolean
    },
    _normaliseBuddy: function(/* anything */buddy){
        // summary:
        //     normalises the passed object to have all attributes required for a buddyItem
        // buddy:
        //     object that can be mapped to a buddyItem
        if (buddy && buddy.id && typeof buddy.jid == "undefined") {
            buddy.jid = buddy.id;
        }
        if (!buddy.jid) {
            throw new Error("RosterStore._normaliseBuddy(): Invalid buddy object received");
        }
    },
    _createBuddyItem: function(/* anything */buddy){
        // summary:
        //     creates a buddyItem for the store from the passed buddy
        // buddy:
        //     object that can be mapped to a buddyItem (should have a jid)
        this._normaliseBuddy(buddy);
        var groups = [];
        if (buddy.groups) {
            for (var j = 0; j < buddy.groups.length; j++) {
                groups.push(buddy.groups[j]);
            }
        }
        var buddyItem = {
            jid: buddy.jid,
            rosterNodeType: "contact",
            groups: groups,
            show: true,
			resources: {},
            presence: this.getOfflinePresence(buddy.jid),
            name: buddy.name
        };
        return buddyItem;//pw.desktop.roster.BuddyItem
    },
    _rosterAdded: function(buddyItem){
        // summary:
        //     This function is called when an item is added in the data source,
        //     updates the store with the new item received
        // buddyItem: pw.desktop.roster.BuddyItem
        //     the item that was added in the data source
        if (this._roster[buddyItem.jid]) {
            var previousBuddyItem = this._roster[buddyItem.jid];
			console.log("updated");
            this._buddyUpdated(buddyItem, previousBuddyItem);
        }
        else {
			console.log("added");
            this._buddyAdded(buddyItem);
        }
    },
    _buddyUpdated: function(buddyItem, previousBuddyItem){
        // summary:
        //     This function is called when an item is added in the data source,
        //     updates the store with the new item received
        // buddyItem: pw.desktop.roster.BuddyItem
        //     the new item
        // previousBuddyItem: pw.desktop.roster.BuddyItem
        //     item that was updated with the new item
        buddyItem.presence = previousBuddyItem.presence;
        this._buddyRemoved(previousBuddyItem);
        this._buddyAdded(buddyItem);
		/*
        pw.publish("/pw/desktop/roster/buddyUpdated/" + buddyItem.jid, [{
            oldBuddyItem: previousBuddyItem,
            newBuddyItem: buddyItem
        }]);
        */
    },
    _putRosterEntryInGroup: function(buddyItem, groupName){
        // summary:
        //     associate the buddyItem to a groupItem
        // buddyItem: pw.desktop.roster.BuddyItem
        //     the buddyItem to be added
        // groupName: String
        //     name of the group for the groupItem
        var groupItem = this._groups[groupName];
        if (!groupItem) {
            groupItem = {
	            name: groupName,
	            rosterNodeType: "group",
	            show: true,
	            visibleChildrenCount: 0,
	            onlineContactsCount: 0,
                children: []
			};
            this._groups[groupName] = groupItem;
            //this.onNew(groupItem);
        }
        groupItem.children.push(buddyItem);
		
        if (buddyItem.show) {
            this._incrementVisibleCount(groupItem);
        }
        this._updateOnlineCount(buddyItem, { show: "offline" }, buddyItem.presence);
		return groupItem;
    },
    _buddyRemoved: function(buddyItem){
        // summary:
        //     This function is called when an item is deleted from the data source,
        //     updates the store by removing the item received
        // buddyItem: pw.desktop.roster.BuddyItem
        //     the item that was deleted from the data source
        delete this._roster[buddyItem.jid];
        var groups = buddyItem.groups;
        if (groups.length === 0) {
            groups.push(this.CONSTANTS.DEFAULT_GROUP_NAME);
        }
        for (var j = 0; j < groups.length; j++) {
            var groupName = groups[j];
            this._removeBuddyItemFromGroup(buddyItem, groupName);
            // Check for empty groups later because the notification for onDelete(group) should come after onDelete(buddy) child items.
        }
        this.onDelete(buddyItem);
        this._removeEmptyGroups(groups);
    },
    _removeEmptyGroups: function(/*String Array*/groups){
        // summary:
        //     Checks all the groupItems in the store and removes those without any children
        for (var groupIndex in groups) {
            var groupName = groups[groupIndex];
            if (this._groups[groupName] && this._groups[groupName].children.length === 0) {
                var groupItem = this._groups[groupName];
                delete this._groups[groupName];
                this.onDelete(groupItem);
            }
        }
    },
    _removeBuddyItemFromGroup: function(buddyItem, groupName){
        // summary:
        //     disassociate the buddyItem from a groupItem
        // buddyItem: pw.desktop.roster.BuddyItem
        //     the buddyItem to be removed
        // groupName: String
        //     name of the group for the groupItem
        var groupItem = this._groups[groupName];
        for (var j = 0; j < groupItem.children.length; j++) {
            var item = groupItem.children[j];
            if (item.jid === buddyItem.jid) {
                if (item.show) {
                    this._decrementVisibleCount(groupItem);
                }
                groupItem.children.splice(j, 1);
                this._updateOnlineCount(buddyItem, buddyItem.presence, { show: "offline" });
                this.onSet(groupItem);
                break;
            }
        }
    },
    _updateOnlineCount: function(buddyItem, oldPresence, newPresence) {
        if ((oldPresence.show === "offline" || newPresence.show === "offline") && oldPresence.show != newPresence.show) {
            for (var i in buddyItem.groups) {
                var groupItem = this._groups[buddyItem.groups[i]];
                groupItem.onlineContactsCount += oldPresence.show === "offline" ? 1 : -1;
                this.onSet(groupItem);
            }
            if(!buddyItem.groups.length) {
                var groupItem = this._groups[this.CONSTANTS.DEFAULT_GROUP_NAME];
                groupItem.onlineContactsCount += oldPresence.show === "offline" ? 1 : -1;
                this.onSet(groupItem);
            }
        }
    },
    copyBuddyToGroups: function(buddyItem, groupNames){
        var rosterService = pw.desktop.getKernel().getCurrentUserSession().getSession().rosterService;
        for (var i in groupNames) {
            rosterService.addRosterItemToGroup(buddyItem.jid, groupNames[i]);
        }
    },
    moveBuddyToGroups: function(buddyItem, groupNames){
        var currentGroups = buddyItem.groups;
        var rosterService = pw.desktop.getKernel().getCurrentUserSession().getSession().rosterService;
        for (var i in currentGroups) {
            rosterService.removeRosterItemFromGroup(buddyItem.jid, currentGroups[i]);
        }
        this.copyBuddyToGroups(buddyItem, groupNames);
    },
    _updateBuddyPresence: function(p){
        // summary:
        //     this function is called when a presence packet is received for a buddyItem;
        //     ignore presencePacket if buddyItem does not exist in the roster
        var buddyItem = this._roster[p.from];
        if (buddyItem) {
            var oldBuddyItem = dojo.mixin({}, buddyItem);
            buddyItem.presence = {
                from: p.from,
                show: p.show,
                type: p.type,
                status: p.status
            };
            this.onSet(buddyItem, "presence", oldBuddyItem.presence, buddyItem.presence);
            pw.publish("/pw/desktop/roster/buddyUpdated/" + p.from, [{
                attribute: "presence",
                newBuddyItem: buddyItem
            }]);
            this._updateOnlineCount(buddyItem, oldBuddyItem.presence, buddyItem.presence);
        }
    },
    _buddyAdded: function(/* pw.desktop.roster.BuddyItem */buddyItem){
        // summary:
        //     This function is called when an item is added to the data source,
        //     updates the store by adding the item received
        // buddyItem: pw.desktop.roster.BuddyItem
        //     the item that was added to the data source
        this._roster[buddyItem.jid] = buddyItem;
        if (buddyItem) {
            if (buddyItem.groups.length === 0) {
                this.onNew(buddyItem, {
					item: this._putRosterEntryInGroup(buddyItem, this.CONSTANTS.DEFAULT_GROUP_NAME),
					attribute: "children"
				});
            }
            else {
                for (var j = 0; j < buddyItem.groups.length; j++) {
                    var groupName = buddyItem.groups[j];
                    this.onNew(buddyItem, {
						item: this._putRosterEntryInGroup(buddyItem, groupName),
						attribute: "children"
					});
                }
            }
        }
        this._filterBuddyItem(buddyItem);
    },
	
	_presenceUpdateHandler: function(msg) {
		var bareJid = dojox.xmpp.util.getBareJid(msg.getAttribute("from"));
		var p = {
		    from: bareJid,
		    resource: dojox.xmpp.util.getResourceFromJid(msg.getAttribute('from')),
		    show: dojox.xmpp.presence.STATUS_ONLINE,
		    priority: 5,
		    hasAvatar: false
		}   
		
		if(msg.getAttribute('type')=='unavailable'){
		    p.show = this.CONSTANTS.presence.STATUS_OFFLINE
		}
		
        for (var i=0; i<msg.childNodes.length;i++){
            var n=msg.childNodes[i];
            if (n.hasChildNodes()){
                switch(n.nodeName){
                    case 'status':
                    case 'show':
                        p[n.nodeName]=n.firstChild.nodeValue;
                        break;
                    case 'status':
                        p.priority=parseInt(n.firstChild.nodeValue);
                        break;
                    case 'x':
                        if(n.firstChild && n.firstChild.firstChild &&  n.firstChild.firstChild.nodeValue != "") { 
                            p.avatarHash = n.firstChild.firstChild.nodeValue;
                            p.hasAvatar = true;
                        }
                        break;
                }
            }
        }
		
		if(this._isRosterFetched) {
			var oldPresence = this._roster[bareJid].presence, resources = this._roster[bareJid].resources;
			
			if(resources[p.resource.toString()] && (p.show === this.CONSTANTS.presence.STATUS_OFFLINE)) {
				console.log("Deleting " + p.resource);
				delete resources[p.resource];
			} else if (p.show !== this.CONSTANTS.presence.STATUS_OFFLINE) {
				resources[p.resource] = p;
			}
			this._chooseBestPresence(this._roster[bareJid]);
			this._updateOnlineCount(this._roster[bareJid], oldPresence, this._roster[bareJid].presence);
            this.onSet(this._roster[bareJid], "presence", oldPresence, this._roster[bareJid].presence);
		} else {
			if(!this._tempPresence[bareJid]) {
				this._tempPresence[bareJid] = {};
			}
			this._tempPresence[bareJid][p.resource] = p;
		}
		
		this._session.onPresenceUpdate(p);    // For backwards compatibility. To be removed in 2.0.
	},
	
	_chooseBestPresence: function(rosterEntry) {
		// First sanitize. If there were temporarily stored presence information, clean that up.
		var bareJid = rosterEntry.jid;
		if(this._tempPresence[bareJid]) {
			for(var key in this._tempPresence[bareJid]) {
				rosterEntry.resources[key] = this._tempPresence[bareJid][key];
				delete this._tempPresence[bareJid][key];
			}
		}
		
		var resourceList = []; 
		for(key in rosterEntry.resources) {
			resourceList.push(key);
		}
		
		if(resourceList.length) {
			var presencePriority = {
				online: 1,
				chat: 1,
				dnd: 2,
				away: 3,
				xa: 4
			}
			resourceList.sort(function(item1, item2) {
				return (presencePriority[rosterEntry.resources[item1].show] - presencePriority[rosterEntry.resources[item2].show]);
			});
			
			rosterEntry.presence = rosterEntry.resources[resourceList[0]];
		} else {
			rosterEntry.presence = {
				show: "offline",
				status: ""
			};
		}
	},
	
    _createRosterEntry: function(elem) {
        var presenceNs = dojox.xmpp.presence, jid = dojox.xmpp.util.getBareJid(elem.getAttribute("jid"));
        
        var re = {
            name: elem.getAttribute("name") || jid,
			rosterNodeType: "contact",
			show: true,
			resources: {},
            jid: jid,
            status: (elem.getAttribute("subscription") || presenceNs.SUBSCRIPTION_NONE),
            substatus: ((elem.getAttribute("ask")=="subscribe")?presenceNs.SUBSCRIPTION_REQUEST_PENDING:presenceNs.SUBSCRIPTION_SUBSTATUS_NONE),
            type: "buddy",
            groups: []
        };
        
		this._chooseBestPresence(re);
		
        var groupNodes = dojo.query("group:not(:empty)", elem);
        
		if(groupNodes.length) {
            groupNodes.forEach(function(groupNode){
				var groupName = groupNode.firstChild.nodeValue;
                re.groups.push(groupName);
                this._putRosterEntryInGroup(re, groupName);
            }, this);
		} else {
			this._putRosterEntryInGroup(re, this.CONSTANTS.DEFAULT_GROUP_NAME);
		}
		
		//Display contact rules from http://www.xmpp.org/extensions/xep-0162.html#contacts
        /*
        if(re.status == dojox.xmpp.presence.SUBSCRIPTION_REQUEST_PENDING || 
            re.status == dojox.xmpp.presence.SUBSCRIPTION_TO || 
            re.status == dojox.xmpp.presence.SUBSCRIPTION_BOTH ||
            re.groups.length > 0 ||
            re.name
            ) {
	            re.displayToUser = true;
	        }
        */

		this._session.roster.push(re);   // For backwards compatibility. To be removed in 2.0.
		this._roster[re.jid] = re;
		return re;
	},
	
	getStoreRepresentation: function() {
        var treeContents, groupNamesList = [];
		
        for (var groupName in this._groups) {
			groupNamesList.push(groupName);
        }
		
		groupNamesList.sort(function(a, b) {
			var a = a.toLowerCase(), b = b.toLowerCase();
			return (a===b)?0:(a<b?-1:1);
		});
		
		treeContents = dojo.map(groupNamesList, function(groupName) {
			return this._groups[groupName];
		}, this);
		
		return treeContents;
	},
	
	onFetchComplete: function() {},
	
    _fetchItems: function(/* Object */keywordArgs, /* Function */ findCallback, /* Function */ errorCallback){
        if(!this._isRosterFetched) {
            var props={
                id: this._session.getNextIqId(),
                from: this._session.jid + "/" + this._session.resource,
                type: "get"
            }
            var req = new dojox.string.Builder();
            req.append(
                dojox.xmpp.util.createElement("iq",props,false),
                    dojox.xmpp.util.createElement("query",{xmlns: "jabber:iq:roster"},true),
                "</iq>"
            );

            var def = this._session.dispatchPacket(req,"iq", props.id);
            def.addCallback(dojo.hitch(this, function(msg) {
                if ((msg.getAttribute('type') == 'result')) {
                    // Iterate over roster items
					var session = this._session;
					session.onRetrieveRoster(msg); // For backwards compatibility. To be removed in 2.0.
					dojo.query("query[xmlns='jabber:iq:roster'] > item", msg).forEach(this._createRosterEntry, this);
					
					this._isRosterFetched = true;
					findCallback(this.getStoreRepresentation(keywordArgs), keywordArgs);
					
					session.setState(dojox.xmpp.xmpp.ACTIVE); // For backwards compatibilty. To be removed in 2.0.
					session.onRosterUpdated(); // For backwards compatibilty. To be removed in 2.0.
                } else if (msg.getAttribute('type') == "error") {
                    this._isRosterFetched = false;
                    errorCallback("Error", keywordArgs);  
                }
            }));
        } else {
            findCallback(this.getStoreRepresentation(keywordArgs), keywordArgs);
        }
    },
    filter: function(/*String*/pattern){
        // summary:
        //     sets show attribute of rosterItems to true/false based on the pattern matching to item's jid and name,
        //     also triggers filterGroupOnRosterItemChange() for each group of updated rosterItem
        // pattern: String
        //     it is passed to the Regex constructor; 
        //     regular expression to apply on rosterItem's jid and name
        var regExFilterPattern = null;
        if (pattern) {
            regExFilterPattern = new RegExp(pattern, "i");
        }
        for (var jid in this._roster) {
            var buddyItem = this._roster[jid];
            this._filterBuddyItem(buddyItem, regExFilterPattern);
        }
    },
    _filterBuddyItem: function(/* pw.desktop.roster.BuddyItem */buddyItem, regEx){
        // summary:
        //     This function is called to filter a buddyItem item in data source, 
        //     using stored regExFilterPattern
        // buddyItem: pw.desktop.roster.BuddyItem
        //     the item that is to be filtered
        var oldBuddyShow = buddyItem.show;
        if (regEx) {
            // required explicit typecast to boolean
            var jidMatch = !!buddyItem.jid.match(regEx);
            var nameMatch = !!(typeof buddyItem.name == "string" && buddyItem.name.match(regEx));
            buddyItem.show = jidMatch || nameMatch;
        }
        else {
            buddyItem.show = true;
        }
		
        if (oldBuddyShow != buddyItem.show) {
            this.onSet(buddyItem, "show", oldBuddyShow, buddyItem.show);
            if (buddyItem.groups.length > 0) {
                dojo.forEach(buddyItem.groups, function(groupName){
                    this._filterGroupOnRosterItemChange(groupName, buddyItem.show);
                }, this);
            }
            else {
                this._filterGroupOnRosterItemChange(this.CONSTANTS.DEFAULT_GROUP_NAME, buddyItem.show);
            }
        }
    },
    _incrementVisibleCount: function(groupItem){
        this._setVisibleCount(groupItem, groupItem.visibleChildrenCount + 1);
    },
    _decrementVisibleCount: function(groupItem){
        this._setVisibleCount(groupItem, groupItem.visibleChildrenCount - 1);
    },
    _setVisibleCount: function(groupItem, count){
        if (count >= 0 && count <= groupItem.children.length) {
            groupItem.visibleChildrenCount = count;
            var oldGroupShow = groupItem.show;
            groupItem.show = (groupItem.visibleChildrenCount > 0);
            if (oldGroupShow != groupItem.show) {
                this.onSet(groupItem, "show", oldGroupShow, groupItem.show);
            }
        }
    },
    _filterGroupOnRosterItemChange: function(/* String */groupName, /* Boolean */ rosterItemShow){
        // summary:
        //     sets show attribute of the group item to true/false based on the number of visible child rosterItems;
        //     It is called after a rosterItem's show attribute is set
        // groupName: String
        //     name of the group to validate filter
        // rosterItemShow: Boolean
        //     Whether this function was triggered on rosterItem shown (true) or hidden (false)
        var groupItem = this._groups[groupName];
        if (rosterItemShow) {
            this._incrementVisibleCount(groupItem);
        }
        else {
            this._decrementVisibleCount(groupItem);
        }
    },
    getGroupStore: function(){
        var groupsData = {
            label: "name",
            items: []
        }
        for (var groupName in this._groups) {
            if (groupName == this.CONSTANTS.DEFAULT_GROUP_NAME) {
                continue;
            }
            groupsData.items.push({
                name: groupName
            });
        }
        for (var i = 0; i < groupsData.items.length - 1; i++) {
            for (var j = i + 1; j < groupsData.items.length; j++) {
                if (groupsData.items[i].name > groupsData.items[j].name) {
                    var temp = groupsData.items[i];
                    groupsData.items[i] = groupsData.items[j];
                    groupsData.items[j] = temp;
                }
            }
        }
        return new dojo.data.ItemFileReadStore({
            data: groupsData
        });
    },
	getGroups: function() {
		return this._groups;
	},
	getRoster: function() {
		return this._roster;
	},
    onSet: function(/* item */item, /* attribute-name-string */ attribute, /* object | array */ oldValue, /* object | array */ newValue){
        // summary:
        //     See dojo.data.api.Notification.onSet()
    },
    onNew: function(/* item */newItem, /*object?*/ parentInfo){
        // summary:
        //     See dojo.data.api.Notification.onNew()
    },
    onDelete: function(/* item */deletedItem){
        // summary:
        //     See dojo.data.api.Notification.onDelete()
    },
	
	newItem: function(kwArgs, parent) {
		console.log("newItem ", kwArgs, parent);
	},
	
	save: function(kwArgs) {
		console.log("save ", kwArgs);
	},
	
	setValue: function(item, attribute, value) {
		console.log("setValue ", item, attribute, value);
	},
	
	setValues: function(item, attribute, values) {
		this._assertIsItem(item);
		this._assertIsAttribute(attribute);
		
		
		
		console.log("setValues ", item, attribute, values);
	},
	
	revert: function() {
		console.log("revert");
	},
	
	deleteItem: function(item) {
		console.log("deleteItem ", item);
	},
	
	isDirty: function(item) {
		console.log("isDirty ", item);
	}
});

//Mix in the simple fetch implementation to this class.
dojo.extend(dojox.xmpp.im.RosterStore, dojo.data.util.simpleFetch);