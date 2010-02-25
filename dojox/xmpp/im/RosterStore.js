dojo.provide("dojox.xmpp.im.RosterStore");

dojo.require("dojox.xmpp.im._rosterBase.RosterReadStore");
dojo.require("dojox.xmpp.im._rosterBase.RosterWriteStore");
dojo.require("dojox.xmpp.im._rosterBase.RosterDsl");

dojo.declare("dojox.xmpp.im.RosterStore", [
	    dojox.xmpp.im._rosterBase.RosterReadStore,
		dojox.xmpp.im._rosterBase.RosterWriteStore,
		dojox.xmpp.im._rosterBase.RosterDsl
	], {});