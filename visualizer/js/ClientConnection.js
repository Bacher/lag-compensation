const ONE_WAY_DELAY = 100;

class ClientConnection {

    constructor() {
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

        server.onMessage(pack.eventName, JSON.parse(pack.json));

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

        client.onServerMessage(pack.eventName, JSON.parse(pack.json));

        if (this._toClientQueue.length) {
            setTimeout(() => this._processToClientQueue(), this._toClientQueue[0].receiveAfter - Date.now());
        }
    }

    _getDelay() {
        return ONE_WAY_DELAY;
    }

}
