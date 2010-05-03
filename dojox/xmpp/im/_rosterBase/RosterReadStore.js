dojo.provide("dojox.xmpp.im._rosterBase.RosterReadStore");

dojo.require("dojo.data.util.filter");
dojo.require("dojo.data.util.simpleFetch");

dojo.require("dojox.xmpp.util");

dojo.declare("dojox.xmpp.im._rosterBase.RosterReadStore", null, {
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
    constructor: function(){
        this._features = {
            'dojo.data.api.Read': true,
            'dojo.data.api.Notification': true,
            'dojo.data.api.Identity': true
        };
    },
    bindSession: function(session){
        // summary:
        //     This function is to be called for registering a new session with the RosterStore. The store would be reset if a session was already bound.
        // session:
        //     instance of xmppSession
        this._roster = {};
        this._groups = {};
        this._tempPresence = {};  // For temporarily storing presence information, incase the roster isn't available yet.
        this._isRosterFetched = false;
        this._session = session;
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

        session.registerPacketHandler({
            name: "RosterIqSetHandler",
            condition: function(msg) {
                if(msg.nodeName === "iq" &&
                msg.getAttribute("type") === "set" &&
                msg.getElementsByTagName("query").length &&
                msg.getElementsByTagName("query")[0].getAttribute("xmlns") === "jabber:iq:roster") {
                    return true;
                }
                return false;
            },
            handler: dojo.hitch(this, "_rosterSetHandler")
        });

        dojo.connect(session, "onConnectionError", this, function() {
            for(var jid in this._roster) {
                if(this._roster[jid].presence.show !== this.CONSTANTS.presence.STATUS_OFFLINE) {
                    this._roster[jid].resources = {};
                    this._roster[jid].presence = this._getOfflinePresence();
                    this.onSet(this._roster[jid], "presence"); // TODO: FIXME
                }
            }

            for(var groupName in this._groups) {
                this._setGroupCounts(groupName);
            }
        });
    },
    startup: function(){
        // Left here for legacy stuff.
    },
    _rosterSetHandler: function(msg) {
        dojo.query("item", msg).forEach(function(item) {
            var matchedRosterItem = this._roster[item.getAttribute("jid")];

            if(matchedRosterItem) {
                if(item.getAttribute("subscription") === "remove") {
                    var groupsList = [].concat(matchedRosterItem.groups);

                    if(!groupsList.length) {
                        groupsList.push(this.CONSTANTS.DEFAULT_GROUP_NAME);
                    }

                    dojo.forEach(groupsList, function(group){
                        this._removeRosterEntryFromGroup(matchedRosterItem, group, true);
                    }, this);

                    this.onDelete(matchedRosterItem);
                    delete this._roster[item.getAttribute("jid")];

                    // Cleanup empty groups, if any
                    this._removeEmptyGroups();
                } else {    // update
                    var oldRosterEntry = dojo.clone(matchedRosterItem);
                    var attributesChanged = [];

                    var itemName = item.getAttribute("name");
                    if(itemName && itemName !== matchedRosterItem.name) {
                        matchedRosterItem.name = itemName;
                        attributesChanged.push("name");
                    }

                    var subscription = item.getAttribute("subscription");
                    if(subscription && subscription !== matchedRosterItem.status) {
                        matchedRosterItem.status = subscription;
                        attributesChanged.push("status");
                    }

                    var oldSubStatus = matchedRosterItem.substatus;
                    matchedRosterItem.substatus = this.CONSTANTS.presence.SUBSCRIPTION_SUBSTATUS_NONE;
                    if(item.getAttribute('ask')=='subscribe') {
                        matchedRosterItem.substatus = this.CONSTANTS.presence.SUBSCRIPTION_REQUEST_PENDING;
                    }
                    if(oldSubStatus !== matchedRosterItem.substatus) {
                        attributesChanged.push("substatus");
                    }

                    var groupsChanged = [], newGroups = dojo.query("group", item).filter(function(groupNode) {
                        return !!groupNode.firstChild;    // Ensure that the group node has children
                    }).map(function(groupNode) {
                        return groupNode.firstChild.nodeValue;
                    });

                    // Remove user from old groups if any.
                    dojo.forEach(matchedRosterItem.groups, function(group) {
                        if(group && dojo.indexOf(newGroups, group) === -1) {
                            groupsChanged.push(this._removeRosterEntryFromGroup(matchedRosterItem, group, true));
                            matchedRosterItem.groups.splice(dojo.indexOf(matchedRosterItem.groups, group), 1);
                        }
                    }, this);

                    // Add user to new groups, if any.
                    dojo.forEach(newGroups, function(group) {
                        if(dojo.indexOf(matchedRosterItem.groups, group) === -1) {
                            groupsChanged.push(this._putRosterEntryInGroup(matchedRosterItem, group, true));
                            matchedRosterItem.groups.push(group);
                            this.onNew(matchedRosterItem, {
                                item: this._groups[group],
                                attribute: "children"
                            });
                        }
                    }, this);

                    // Add user to the default group, if he is not a member of any group.
                    if(!matchedRosterItem.groups.length) {
                        this.onNew(matchedRosterItem, {
                            item: this._groups[this.CONSTANTS.DEFAULT_GROUP_NAME],
                            attribute: "children"
                        });
                    }

                    dojo.forEach(attributesChanged, function(attribute) {
                        this.onSet(matchedRosterItem, attribute, oldRosterEntry[attribute], matchedRosterItem[attribute]);
                    }, this);

                    // Cleanup empty groups, if any
                    if(groupsChanged.length) {
                        this._removeEmptyGroups();
                    }
                }
            } else if(item.getAttribute("subscription") !== "remove") {  // This is a new entry to the roster
                var newRosterEntry = this._createRosterEntry(item);

                if(newRosterEntry.groups.length) {
                    dojo.forEach(newRosterEntry.groups, function(groupName) {
                        this.onNew(newRosterEntry, {
                            item: this._groups[groupName],
                            attribute: "children"
                        });
                    }, this);
                } else {
                    this.onNew(newRosterEntry, {
                        item: this._groups[this.CONSTANTS.DEFAULT_GROUP_NAME],
                        attribute: "children"
                    });
                }
            }
        }, this);

        // Send a result packet to the server to confirm changes
        var req = {
            id: msg.getAttribute("id"),
            to: msg.getAttribute("from") || this._session.domain,
            type: 'result',
            from: this._session.jid + "/" + this._session.resource
        };
        this._session.dispatchPacket(dojox.xmpp.util.createElement("iq",req,true));
    },

    _getOfflinePresence: function(jid){
        return {
            show: this.CONSTANTS.presence.STATUS_OFFLINE,
            status: ""
        };
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
        if (item.rosterNodeType == "contact"){
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
        this._assertIsItem(item);
        this._assertIsAttribute(attribute);
        var value = dojo.getObject(attribute, false, item);
        return (value !== undefined) ? value : defaultValue; // mixed
    },
    getValues: function(/* item */item, /* attribute-name-string */ attribute){
        // summary:
        //     See dojo.data.api.Read.getValues()
        var value = this.getValue(item, attribute);
        return value?(attribute=="children"?value:[value]):[]; // Array
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
    _putRosterEntryInGroup: function(buddyItem, groupName, fireOnSetForGroup){
        // summary:
        //     associate the buddyItem to a groupItem
        // buddyItem: pw.desktop.roster.BuddyItem
        //     the buddyItem to be added
        // groupName: String
        //     name of the group for the groupItem
        var groupItem = this._groups[groupName], newlyCreated = true, oldGroupItemChildren;

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
            oldGroupItemChildren = null;
            //this.onNew(groupItem);
        } else {
            newlyCreated = false;
            oldGroupItemChildren = [].concat(groupItem.children);
        }
        groupItem.children.push(buddyItem);

        this._setGroupCounts(groupName);

        if(fireOnSetForGroup) {
            if(newlyCreated) {
                this.onNew(groupItem);
            } else {
                this.onSet(groupItem, "children", oldGroupItemChildren, groupItem.children);
            }
        }

        return groupItem;
    },

    _removeRosterEntryFromGroup: function(buddyItem, groupName, fireOnDelete) {
        var groupItem = this._groups[groupName];
        if (groupItem && dojo.indexOf(groupItem.children, buddyItem) !== -1) {
            var deletedBuddy = groupItem.children.splice(dojo.indexOf(groupItem.children, buddyItem), 1);
            if(fireOnDelete) {
                this.onDelete(deletedBuddy[0]);
            }

            this._setGroupCounts(groupName);
        }

        return groupItem;
    },

    renameRosterGroup: function(group, newGroup) {
        for(var i in this._roster) {
            var item = this._roster[i];
            for(var j = 0;j < item.groups.length; j++) {
                if (item.groups[j]==group){
                    var newGroups = dojo.clone(item.groups);
                    newGroups[j] = newGroup;
                    this._session.rosterService.updateRosterItem(item.jid, item.name, newGroups);
                }
            }
        }
    },

    removeRosterGroup: function(group) {
        for(var i in this._roster) {
            var item = this._roster[i];
            for(var j = 0;j < item.groups.length; j++) {
                if (item.groups[j]==group){
                    var newGroups = dojo.clone(item.groups);
                    newGroups.splice(j,1);
                    this._session.rosterService.updateRosterItem(item.jid, item.name, newGroups);
                }
            }
        }
    },

    _removeEmptyGroups: function() {
        // summary:
        //     Checks all the groupItems in the store and removes those without any children
        for (var groupName in this._groups) {
            // var groupItem = this._groups[groupName]; // cannot use groupItem; to delete a property from object, we need to specify in this format: delete object[property]

            if (this._groups[groupName].children.length === 0) {
                var deletedGroup = this._groups[groupName];
                delete this._groups[groupName];
                this.onDelete(deletedGroup);
            }
        }
    },

    _presenceUpdateHandler: function(msg) {
        var bareJid = dojox.xmpp.util.getBareJid(msg.getAttribute("from"));
        var p = {
            from: bareJid,
            resource: dojox.xmpp.util.getResourceFromJid(msg.getAttribute('from')),
            show: dojox.xmpp.presence.STATUS_ONLINE,
            priority: 5,
            hasAvatar: false
        };

        if(msg.getAttribute('type')=='unavailable'){
            p.show = this.CONSTANTS.presence.STATUS_OFFLINE;
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
                        p.priority=parseInt(n.firstChild.nodeValue, 10);
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
            if(this._roster[bareJid]) {
                var oldPresence = this._roster[bareJid].presence, resources = this._roster[bareJid].resources;

                if(resources[p.resource.toString()] && (p.show === this.CONSTANTS.presence.STATUS_OFFLINE)) {
                    delete resources[p.resource];
                } else if (p.show !== this.CONSTANTS.presence.STATUS_OFFLINE) {
                    resources[p.resource] = p;
                }
                this._chooseBestPresence(this._roster[bareJid]);
                if(this._roster[bareJid].groups.length) {
                    dojo.forEach(this._roster[bareJid].groups, this._setGroupCounts, this);
                } else {
                    this._setGroupCounts(this.CONSTANTS.DEFAULT_GROUP_NAME);
                }
                this.onSet(this._roster[bareJid], "presence", oldPresence, this._roster[bareJid].presence);
            }
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
        var key, bareJid = rosterEntry.jid;
        if(this._tempPresence[bareJid]) {
            for(key in this._tempPresence[bareJid]) {
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
            };
            resourceList.sort(function(item1, item2) {
                return (presencePriority[rosterEntry.resources[item1].show] - presencePriority[rosterEntry.resources[item2].show]);
            });

            rosterEntry.presence = rosterEntry.resources[resourceList[0]];
        } else {
            rosterEntry.presence = this._getOfflinePresence();
        }
    },

    _createRosterEntrySkeleton: function(jid, name, status, substatus) {
        return {
            name: name || jid,
            rosterNodeType: "contact",
            show: true,
            resources: {},
            jid: jid,
            status: status || dojox.xmpp.presence.SUBSCRIPTION_NONE,
            substatus: substatus,
            type: "buddy",
            groups: [],
            presence: this._getOfflinePresence()
        };
    },

    _createRosterEntry: function(elem) {
        var presenceNs = dojox.xmpp.presence, jid = dojox.xmpp.util.getBareJid(elem.getAttribute("jid"));

        var re = this._createRosterEntrySkeleton(
            jid,
            elem.getAttribute("name"),
            elem.getAttribute("subscription"),
            ((elem.getAttribute("ask")=="subscribe")?presenceNs.SUBSCRIPTION_REQUEST_PENDING:presenceNs.SUBSCRIPTION_SUBSTATUS_NONE)
        );

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
        
    getStoreRepresentation: function(keywordArgs) {
        var self = this, query = keywordArgs.query || {}, queryOptions = keywordArgs.queryOptions || {};
        var treeContents, groupNamesList = [];
        if(query.rosterNodeType === "contact"){
            var pattern = query.name, fieldValue;
            var regexp = dojo.data.util.filter.patternToRegExp(pattern || "", queryOptions.ignoreCase);
            var matchItem = function(item){
                if(!self._matchContactFields){
                    self._matchContactFields = ["jid", "vcard.N.GIVEN", "vcard.N.FAMILY", "vcard.N.MIDDLE", "vcard.NICKNAME"];
                }
                for(var i=0; i < self._matchContactFields.length; i++){
                    fieldValue = self.getValue(item, self._matchContactFields[i]);
                    if(fieldValue){
                        if(fieldValue.toString().match(regexp)){
                            return true;
                        }
                    }
                }
                return false; //Boolean
            };
            treeContents = [];
            for(var jid in this._roster){
                if(matchItem(this._roster[jid])){
                    treeContents.push(this._roster[jid]);
                }
            }
        }else{
            for (var groupName in this._groups) {
                groupNamesList.push(groupName);
            }

            groupNamesList.sort(function(a, b) {
                a = a.toLowerCase();
                b = b.toLowerCase();
                return (a===b)?0:(a<b?-1:1);
            });

            treeContents = dojo.map(groupNamesList, function(groupName) {
                return this._groups[groupName];
            }, this);
        }
        return treeContents;
    },

    onFetchComplete: function() {},

    _fetchItems: function(/* Object */keywordArgs, /* Function */ findCallback, /* Function */ errorCallback){
        if(!this._isRosterFetched) {
            var props={
                id: this._session.getNextIqId(),
                from: this._session.jid + "/" + this._session.resource,
                type: "get"
            };
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
                    try {
                        dojo.query("query[xmlns='jabber:iq:roster'] > item", msg).forEach(this._createRosterEntry, this);
                    } catch(e) {
                        console.log(e);
                    }
                    this._isRosterFetched = true;
                    findCallback(this.getStoreRepresentation(keywordArgs), keywordArgs);
                    this.onRosterLoaded();
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
    onRosterLoaded: function(){
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
    _setGroupCounts: function(groupName) {
        var groupItem = this._groups[groupName];
        // Update display of number of online contacts
        var oldOnlineCount = groupItem.onlineContactsCount;
        groupItem.onlineContactsCount = dojo.filter(groupItem.children, function(buddy) {
            return buddy.presence.show !== this.CONSTANTS.presence.STATUS_OFFLINE;
        }, this).length;

        if(oldOnlineCount !== groupItem.onlineContactsCount) {
            this.onSet(groupItem, "onlineContactsCount", oldOnlineCount, groupItem.onlineContactsCount);
        }

        // Update display of total number of contacts
        var oldChildrenCount = groupItem.visibleChildrenCount;
        groupItem.visibleChildrenCount = dojo.filter(groupItem.children, function(buddy) {
            return buddy.show;
        }).length;

        if(oldChildrenCount !== groupItem.visibleChildrenCount) {
            this.onSet(groupItem, "visibleChildrenCount", oldChildrenCount, groupItem.visibleChildrenCount);
        }

        // FIXME: Taher was updating the groupitem show as well. Not sure why. Need to check.
        /*
        if (count >= 0 && count <= groupItem.children.length) {
            groupItem.visibleChildrenCount = count;
            var oldGroupShow = groupItem.show;
            groupItem.show = (groupItem.visibleChildrenCount > 0);
            if (oldGroupShow != groupItem.show) {
                this.onSet(groupItem, "show", oldGroupShow, groupItem.show);
            }
        }
        */
    },
    _filterGroupOnRosterItemChange: function(/* String */groupName, /* Boolean */ rosterItemShow){
        // summary:
        //     sets show attribute of the group item to true/false based on the number of visible child rosterItems;
        //     It is called after a rosterItem's show attribute is set
        // groupName: String
        //     name of the group to validate filter
        // rosterItemShow: Boolean
        //     Whether this function was triggered on rosterItem shown (true) or hidden (false)

        //var groupItem = this._groups[groupName];
        this._setGroupCounts(groupName);
    },
    getGroupStore: function(){
        var groupsData = {
            label: "name",
            items: []
        };
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

    isDirty: function(item) {
        console.log("isDirty ", item);
    }
});

//Mix in the simple fetch implementation to this class.
dojo.extend(dojox.xmpp.im._rosterBase.RosterReadStore, dojo.data.util.simpleFetch);