/**
* Simplistic messaging with Solace.
* When created, the Simq instance starts (re-)connecting to the specified server/msgVPN with the specified credentials.
* Subcriptions and message publications are always accepted, cached until the connection is (re-)establised.
* Assumes the global "solace" instance is in scope from loading the actual Solace JS API (solclientjs-10.0.0/lib/solclient-debug.js)
*/

var RECONNECT_TIMEOUT=1000
var SUBSCRIBE_TIMEOUT=1000

function Simq(routerUrl, msgVpn, username, password) {
	console.log("eleje");
        this.sessionProps = {
                url:      routerUrl,
                vpnName:  msgVpn,
                userName: username,
                password: password
        };

	// Session connection state: "Connected", "Pending", "Disconnected", "Timer"?
	this.sessionState = "Disconnected";
	console.log("alma");

	// Both maps are keyed by topic name, which is also the correlation key.

	// List of callback functions per topic.
	this.topicCallbacks = new Map();
	// State string per topic: "Subscribed", "Pending", ?
	this.topicSubscriptionState = new Map();

	// Outgoing messages pending connection.
	// push and shift.
	// Replace with a more efficient queue eventually.
	this.outgoingQueue = [];



        var factoryProps = new solace.SolclientFactoryProperties();
        factoryProps.profile = solace.SolclientFactoryProfiles.version10;
        solace.SolclientFactory.init(factoryProps);

        this.session = solace.SolclientFactory.createSession( this.sessionProps );

// define session event listeners
	this.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
		console.log(this);
		this.sessionState = "Connected";
		this.topicCallbacks.forEach(function(key, value, map){
			this.session.subscribe(solace.SolclientFactory.createTopicDestination(key),
				true,
				key,
				SUBSCRIBE_TIMEOUT
			);
			this.topicSubscriptionState.set(key, "Pending");
		});
		//Flush the outgoing queue
		this.outgoingQueue.forEach(function(message) {
			this.session.send(message);
		});
		this.ougoingQueue = []; // TODO: remove one by one instead on success.
	}.bind(this));

	this.session.on(solace.SessionEventCode.SUBSCRIPTION_OK, function (sessionEvent) {
		this.topicSubscriptionState.set(sessionEvent.correlationKey, "Subscribed");
	});

// define message event listener
	this.session.on(solace.SessionEventCode.MESSAGE, function (message) {
		var topic = message.getDestination.getName();
		topicCallbacks[topic].forEach(function(element) { element(message);});
	});
// connect the session

	console.log("First connect attempt.");

        function retryConnect() {
		console.log("Connect attempt.");
                try {
			console.log("ec");
			this.sessionState = "Pending";
			console.log("pec");
                        this.session.connect();
			console.log("kimehetsz");
			
                } catch (error) {
			this.sessionState = "Timer";
			console.log("Holnaputan");
			console.log(error);

                        //retry after timeout
                        window.setTimeout(retryConnect.bind(this), RECONNECT_TIMEOUT);
			console.log("bejohetsz");
                }
        }
	this.retryConnect = retryConnect;

        this.retryConnect();

	function publish(message) {
		if (this.sessionState == "Connected") {
			this.session.send(message);
		} else {
			this.outgoingQueue.push(message);
		}
	}

	this.publish = publish;

	function publishText(topic, text) {
		var message = solace.SolclientFactory.createMessage();
		message.setDestination(solace.SolclientFactory.createTopicDestination(topic));
		message.setBinaryAttachment(text);
		message.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
		this.publish(message);

	}

	this.publishText = publishText;

	function subscribe(topic, callback) {
		if (this.topicCallbacks.has(topic)) {
			this.topicCallbacks[topic].push(callback);
		} else {
			this.topicCallbacks[topic] = [callback];
			this.topicSubscriptionState[topic] = "Pending";
			this.session.subscribe(
				solace.SolclientFactory.createTopicDestination(topic),
				true,
				topic,
				SUBSCRIBE_TIMEOUT
			);
		}
	}

	this.subscribe = subscribe;


}
