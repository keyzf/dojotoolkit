dojo.require("dojo.event.common");
dojo.provide("dojo.event.topic");

dojo.event.topic = new function(){
	this.topics = {};

	this.getTopic = function(topicName){
		if(!this.topics[topicName]){
			this.topics[topicName] = new this.TopicImpl(topicName);
		}
		return this.topics[topicName];
	}

	this.registerPublisher = function(topic, obj, funcName){
		var topic = this.getTopic(topic);
		topic.registerPublisher(obj, funcName);
	}

	this.subscribe = function(topic, obj, funcName){
		var topic = this.getTopic(topic);
		topic.subscribe(obj, funcName);
	}

	this.unsubscribe = function(topic, obj, funcName){
		var topic = this.getTopic(topic);
		topic.unsubscribe(obj, funcName);
	}

	this.destroy = function(topic){
		this.getTopic(topic).destroy();
		delete this.topics[topic];
	}

	this.publishApply = function(topic, args){
		var topic = this.getTopic(topic);
		topic.sendMessage.apply(topic, args);
	}

	this.publish = function(topic, message){
		var topic = this.getTopic(topic);
		// if message is an array, we treat it as a set of arguments,
		// otherwise, we just pass on the arguments passed in as-is
		var args = [];
		// could we use concat instead here?
		for(var x=1; x<arguments.length; x++){
			args.push(arguments[x]);
		}
		topic.sendMessage.apply(topic, args);
	}
}

dojo.event.topic.TopicImpl = function(topicName){
	this.topicName = topicName;

	this.subscribe = function(listenerObject, listenerMethod){
		var tf = listenerMethod||listenerObject;
		var to = (!listenerMethod) ? dj_global : listenerObject;
		dojo.event.kwConnect({
			srcObj:		this, 
			srcFunc:	"sendMessage", 
			adviceObj:	to,
			adviceFunc: tf
		});
	}

	this.unsubscribe = function(listenerObject, listenerMethod){
		var tf = (!listenerMethod) ? listenerObject : listenerMethod;
		var to = (!listenerMethod) ? null : listenerObject;
		dojo.event.kwDisconnect({
			srcObj:		this, 
			srcFunc:	"sendMessage", 
			adviceObj:	to,
			adviceFunc: tf
		});
	}

	this._getJoinPoint = function(){
		return dojo.event.MethodJoinPoint.getForMethod(this, "sendMessage");
	}

	this.setSquelch = function(shouldSquelch){
		this._getJoinPoint().squelch = shouldSquelch;
	}

	this.destroy = function(){
		this._getJoinPoint().disconnect();
	}

	this.registerPublisher = function(publisherObject, publisherMethod){
		dojo.event.connect(publisherObject, publisherMethod, this, "sendMessage");
	}

	this.sendMessage = function(message){
		// The message has been propagated
	}
}

