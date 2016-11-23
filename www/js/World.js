
class World {

    constructor() {
        this._curFrameId    = 0;
        this._curFrameIndex = 0;
        this._intervalId    = null;

        this._frames = [{
            frameId: this._curFrameId,
            clients: [],
            shoots: []
        }];

        this._connectedClients = [];

        this._cmdQueue = []
    }

    updateClientState(clientConnection, data) {
        this._cmdQueue.push({
            type: 'updateState',
            data: {
                clientId: clientConnection.id,
                state:    data
            }
        });
    }

    startSimulation() {
        this._intervalId = setInterval(() => {
            this._process();
        }, 1000 / World.TICK_RATE);
    }

    stopSimulation() {
        clearInterval(this._intervalId);
        this._intervalId = null;
    }

    addClient(clientConnection) {
        this._connectedClients.push(clientConnection);

        this._cmdQueue.push({
            type: 'newClient',
            data: {
                clientId: clientConnection.id
            }
        });
    }

    _getClient(id) {
        for (let client of this._frames[this._curFrameIndex].clients) {
            if (client.id === id) {
                return client;
            }
        }
    }

    _process() {
        const frame = this._makeNewFrame();

        for (let msg of this._cmdQueue) {
            switch (msg.type) {
                case 'newClient':
                    const clientId = msg.data.clientId;
                    const delta    = (clientId === 2 ? 100 : 0);

                    frame.clients.push({
                        id:       clientId,
                        position: {
                            x: delta,
                            y: delta
                        },
                        lookDirection: 0
                    });

                    break;
                case 'updateState': {
                    const state    = msg.data.state;
                    const clientId = msg.data.clientId;

                    const clientModel = this._getClient(msg.data.clientId);
                    clientModel.position      = state.position;
                    clientModel.lookDirection = state.lookDirection;

                    for (let command of state.commands) {
                        switch (command.type) {
                            case 'shoot': {
                                frame.shoots.push({
                                    clientId: clientId,
                                    from:     state.position,
                                    to:       command.to
                                });
                                break;
                            }
                        }
                    }
                    break;
                }
            }
        }

        this._cmdQueue = [];

        // for (let client of frame.clients) {
        //     if (client.direction.x || client.direction.y) {
        //         client.position.x += client.direction.x;
        //         client.position.y += client.direction.y;
        //     }
        // }

        for (let clientConnection of this._connectedClients) {
            clientConnection.sendMessageToClient('updateWorld', frame);
        }
    }

    _getConnectedClient(clientId) {
        for (let clientConnection of this._connectedClients) {
            if (clientConnection.id === clientId) {
                return clientConnection;
            }
        }
    }

    _getCurFrame() {
        return this._frames[this._curFrameIndex];
    }

    _makeNewFrame() {
        const curFrame = this._getCurFrame();

        this._curFrameId++;
        this._curFrameIndex++;

        if (this._curFrameIndex === 30) {
            this._curFrameIndex = 0;
        }

        return this._frames[this._curFrameIndex] = {
            id:      this._curFrameId,
            clients: _.cloneDeep(curFrame.clients),
            shoots:  _.cloneDeep(curFrame.shoots)
        };
    }

}

World.TICK_RATE = 33;
