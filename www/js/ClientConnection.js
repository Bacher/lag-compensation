const USE_LAGS     = true;
const EXTRA_DELAY  = 50;
const DELAY_CHANCE = 20; // percent

class ClientConnection {

    constructor(client) {
        this._client = client;

        this.id = client._id;

        this._toServerQueue = [];
        this._toClientQueue = [];
    }

    sendMessageToServer(eventName, data) {
        if (data === undefined) {
            data = null;
        }

        const json = JSON.stringify(data);

        const delay = this._getDelay();

        this._toServerQueue.push({
            eventName:    eventName,
            json:         json,
            receiveAfter: Date.now() + delay
        });

        if (this._toServerQueue.length === 1) {
            setTimeout(() => this._processToServerQueue(), delay);
        }
    }

    _processToServerQueue() {
        const pack = this._toServerQueue.shift();

        server.onMessage(this, pack.eventName, JSON.parse(pack.json));

        if (this._toServerQueue.length) {
            setTimeout(() => this._processToServerQueue(), this._toServerQueue[0].receiveAfter - Date.now());
        }
    }

    sendMessageToClient(eventName, data) {
        if (data === undefined) {
            data = null;
        }

        const json = JSON.stringify(data);

        const delay = this._getDelay();

        this._toClientQueue.push({
            eventName:    eventName,
            json:         json,
            receiveAfter: Date.now() + delay
        });

        if (this._toClientQueue.length === 1) {
            setTimeout(() => this._processToClientQueue(), delay);
        }
    }

    _processToClientQueue() {
        const pack = this._toClientQueue.shift();

        this._client.onServerMessage(pack.eventName, JSON.parse(pack.json));

        if (this._toClientQueue.length) {
            setTimeout(() => this._processToClientQueue(), this._toClientQueue[0].receiveAfter - Date.now());
        }
    }

    _getDelay() {
        if (USE_LAGS && Math.random() < DELAY_CHANCE / 100) {
            return ClientConnection.ONE_WAY_DELAY + EXTRA_DELAY;
        } else {
            return ClientConnection.ONE_WAY_DELAY;
        }
    }

}

ClientConnection.ONE_WAY_DELAY = 100;
