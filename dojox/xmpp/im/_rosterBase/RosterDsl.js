dojo.provide("dojox.xmpp.im._rosterBase.RosterDsl");

dojo.declare("dojox.xmpp.im._rosterBase.RosterDsl", null, {
	getBuddyItem: function(bareJid) {
		return this._roster[bareJid] || this._createRosterEntrySkeleton(bareJid);
	}
});