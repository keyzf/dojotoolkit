dojo.provide("dojox.xmpp.im._rosterBase.RosterWriteStore");

dojo.declare("dojox.xmpp.im._rosterBase.RosterWriteStore", null, {
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
        console.log("setValue ", item, attribute, value);
    },
    
    setValues: function(item, attribute, values) {
        this._assertIsItem(item);
        this._assertIsAttribute(attribute);
		
		if(item.rosterNodeType !== "group" || attribute !== "children") {
			return;
		}
		
		//First find if an item went missing
        var currentRosterItemsInGroup = item.children, missingChildren = [];
		dojo.forEach(currentRosterItemsInGroup, function(rosterItem) {
			if(!dojo.some(values, function(newRosterItem) {
				return rosterItem === newRosterItem;
			})) {
				missingChildren.push(rosterItem);
			}
		});
		
		dojo.forEach(missingChildren, function(rosterItem) {
			if(rosterItem.groups.length && dojo.indexOf(rosterItem.groups, item.name) !== -1) {
				rosterItem.groups.splice(rosterItem.groups.indexOf(item.name), 1);
				
				this._saveRosterItem(rosterItem, item.name);
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
			if(dojo.indexOf(rosterItem.groups, item.name) === -1 && item.name !== this.CONSTANTS.DEFAULT_GROUP_NAME) {
				rosterItem.groups.push(item.name);
				
				this._saveRosterItem(rosterItem, item.name);
			}
		}, this);
    },
    
	_saveRosterItem: function(rosterItem, group) {
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
		def.addCallback(dojo.hitch(function() {
			this.onSet(this._groups[group], "children");
		}));
	},
	
    revert: function() {
        console.log("revert");
    },
    
    deleteItem: function(item) {
        console.log("deleteItem ", item);
    }
});
