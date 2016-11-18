
class Server {

    constructor() {
        this._world = new World();
        this._world.startSimulation();
    }

    onMessage(clientConnection, eventName, data) {
        switch (eventName) {
            case 'connect':
                this._world.addClient(clientConnection);
                break;
            case 'updateState':
                this._world.updateClientState(clientConnection, {
                    position: data
                });
                break;
        }
    }

}
