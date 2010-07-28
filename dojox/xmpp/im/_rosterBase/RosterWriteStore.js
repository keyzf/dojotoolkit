dojo.provide("dojox.xmpp.im._rosterBase.RosterWriteStore");

dojo.declare("dojox.xmpp.im._rosterBase.RosterWriteStore", null, {
    _toBeUpdated: {},
    constructor: function() {
        this._features["dojo.data.api.Write"] = true;
    },
    
    newItem: function(kwArgs, parent) {
        console.log("newItem ", kwArgs, parent);
    },
    
    save: function(kwArgs) {
        console.log("save ", kwArgs);
    },
    
    setValue: function(item, attribute, value) {
         this._assertIsItem(item);
         this._assertIsAttribute(attribute);
    },
    
    setValues: function() {
        var args = [];
        if(!arguments[0].length) {
            args.push({
                item: arguments[0],
                attribute: arguments[1],
                values: arguments[2]
            });
        }
        else {
            for(var i = 0; i < arguments[0].length; ++i) {
                args.push(arguments[0][i]);
            }
        }
        this._toBeUpdated = {};
        args.forEach(dojo.hitch(this, function(arg) {
            var item = arg.item, attribute = arg.attribute, values = arg.values;
            this._assertIsItem(item);
            this._assertIsAttribute(attribute);
            if(item.rosterNodeType === "group" && attribute === "children") {
                this._setGroupChildrenInStore(item, attribute, values, this._toBeUpdated);
            }
            else if(item.rosterNodeType === "contact" && attribute === "groups") {
                values.forEach(dojo.hitch(this, function(value) {
                    this._updateItemInStore(item.jid, value, "add", true);
                    this._toBeUpdated[item.jid] = item;
                }));
            }
        }));
        setTimeout(dojo.hitch(this, function() {
            for(var jid in this._toBeUpdated) {
                this._saveRosterItem(this._toBeUpdated[jid]);
                delete this._toBeUpdated[jid];
            }
        }), 1000);
    },
    _setGroupChildrenInStore: function(item, attribute, values) {
        //First find if an item was removed
        var currentRosterItemsInGroup = item.children, removedChildren = [];
        dojo.forEach(currentRosterItemsInGroup, function(rosterItem) {
            if(!dojo.some(values, function(newRosterItem) {
                return rosterItem === newRosterItem;
            })) {
                removedChildren.push(rosterItem);
            }
        });

        dojo.forEach(removedChildren, function(rosterItem) {
            if(item.name === this.CONSTANTS.DEFAULT_GROUP_NAME || dojo.indexOf(rosterItem.groups, item.name) !== -1) {
                this._updateItemInStore(rosterItem.jid, item.name, "remove", true);
                this._toBeUpdated[rosterItem.jid] = rosterItem;
            }
        }, this);

        //Now, find if a item has been added
        var newChildren = [];
        dojo.forEach(values, function(newRosterItem) {
            if(!dojo.some(currentRosterItemsInGroup, function(rosterItem) {
                return rosterItem === newRosterItem;
            })) {
                newChildren.push(newRosterItem);
            }
        });

        dojo.forEach(newChildren, function(rosterItem) {
            if(dojo.indexOf(rosterItem.groups, item.name) === -1) {
                this._updateItemInStore(rosterItem.jid, item.name, "add", true);
                this._toBeUpdated[rosterItem.jid] = rosterItem;
            }
        }, this);        
    },
    _updateItemInStore: function(jid, group, action, fireOnEvent) {
        var rosterItemInStore = this._roster[jid];
        if(action === "remove") {
            if(group != this.CONSTANTS.DEFAULT_GROUP_NAME) {
                rosterItemInStore.groups.splice(rosterItemInStore.groups.indexOf(group), 1);
            }
            this._removeRosterEntryFromGroup(rosterItemInStore, group, !rosterItemInStore.groups.length);
            this._removeEmptyGroups(); // TODO: Check only for this group
        }
        else if(action === "add") {
            if(rosterItemInStore.groups.indexOf(group) !== -1) return;
            if(group != this.CONSTANTS.DEFAULT_GROUP_NAME) {
                rosterItemInStore.groups.push(group);
            }
            this._putRosterEntryInGroup(rosterItemInStore, group, fireOnEvent);
        }
    },
    _saveRosterItem: function(rosterItem, action) {
        if(action === "remove") {
             var sessionWrapper = pw.desktop.getKernel().getCurrentUserSession();
             if (sessionWrapper) {
                 var session = sessionWrapper.getSession();
                 session.rosterService.removeRosterItem(rosterItem.jid);
             }
             return;
        }
        var req = {
            id: this._session.getNextIqId(),
            from: this._session.jid + "/" + this._session.resource,
            type: "set"
        }

        var request = new dojox.string.Builder(dojox.xmpp.util.createElement("iq", req, false));
        request.append(dojox.xmpp.util.createElement("query",{xmlns: 'jabber:iq:roster'},false));
        request.append(dojox.xmpp.util.createElement("item",{
            jid: rosterItem.jid,
            name: dojox.xmpp.util.xmlEncode(rosterItem.name)
        },false));
        
        dojo.forEach(rosterItem.groups, function(group) {
            request.append("<group>" + group + "</group>");
        });
        request.append("</item></query></iq>");
        
        console.log(request.toString());
        var def = this._session.dispatchPacket(request.toString(),"iq",req.id);
        /*
        def.addCallback(dojo.hitch(function() {
            this.onSet(this._groups[group], "children");
        }));*/
    },
    
    revert: function() {
        console.log("revert");
    },
    
    deleteItem: function(item) {
        console.log("deleteItem ", item);
    }
});
