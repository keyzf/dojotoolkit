dojo.provide("dojo.DeferredList");
dojo.declare("dojo.DeferredList", dojo.Deferred, {
	constructor: function(list, /*bool?*/ fireOnOneCallback, /*bool?*/ fireOnOneErrback, /*bool?*/ consumeErrors, /*Function?*/ canceller){
		this.list = list;
		this.resultList = new Array(this.list.length);

		// Deferred init
		this.chain = [];
		this.id = this._nextId();
		this.fired = -1;
		this.paused = 0;
		this.results = [null, null];
		this.canceller = canceller;
		this.silentlyCancelled = false;

		if (this.list.length === 0 && !fireOnOneCallback) {
			this.callback(this.resultList);
		}

		this.finishedCount = 0;
		this.fireOnOneCallback = fireOnOneCallback;
		this.fireOnOneErrback = fireOnOneErrback;
		this.consumeErrors = consumeErrors;

		var index = 0;

		dojo.forEach(this.list, function(d, index) {
			d.addCallback(this, function(r) { this._cbDeferred(index, true, r); return r; });
			d.addErrback(this, function(r) { this._cbDeferred(index, false, r); return r; });
			index++;
		},this);
	},

	_cbDeferred: function (index, succeeded, result) {
		//dojo.debug("Fire "+index+" succ "+succeeded+" res "+result);
		this.resultList[index] = [succeeded, result]; this.finishedCount += 1;
		if (this.fired !== 0) {
			if (succeeded && this.fireOnOneCallback) {
				this.callback([index, result]);
			} else if (!succeeded && this.fireOnOneErrback) {
			this.errback(result);
			} else if (this.finishedCount == this.list.length) {
				this.callback(this.resultList);
			}
		}
		if (!succeeded && this.consumeErrors) {
			result = null;
		}
		return result;
	},

	gatherResults: function (deferredList) {
		var d = new dojo.DeferedList(deferredList, false, true, false);
		d.addCallback(function (results) {
			var ret = [];
			for (var i = 0; i < results.length; i++) {
				ret.push(results[i][1]);
			}
			return ret;
		});
		return d;
	}
});
