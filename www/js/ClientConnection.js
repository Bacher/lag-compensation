const USE_LAGS    = true;
const EXTRA_DELAY = 40;

class ClientConnection {

    constructor(client) {
        this._client = client;

        this.id = client._id;
    }

    sendMessageToServer(eventName, data) {
        if (data === undefined) {
            data = null;
        }

        const json = JSON.stringify(data );

        setTimeout(() => {
            server.onMessage(this, eventName, JSON.parse(json));
        }, ClientConnection.ONE_WAY_DELAY + (USE_LAGS && Math.random() < 0.1 ? EXTRA_DELAY : 0));
    }

    sendMessageToClient(eventName, data) {
        if (data === undefined) {
            data = null;
        }

        const json = JSON.stringify(data);

        setTimeout(() => {
            this._client.onServerMessage(eventName, JSON.parse(json));
        }, ClientConnection.ONE_WAY_DELAY + (USE_LAGS && Math.random() < 0.1 ? EXTRA_DELAY : 0));
    }

}

ClientConnection.ONE_WAY_DELAY = 100;
