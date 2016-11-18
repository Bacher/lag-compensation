const SIN_P4 = 0.7071067811865475;

class Client {

    constructor(container, id) {
        this._id = id;

        this._connection = new ClientConnection(this);

        this._canvas = document.createElement('canvas');
        this._canvas.classList.add('client');
        this._canvas.width  = Client.CANVAS_WIDTH;
        this._canvas.height = Client.CANVAS_HEIGHT;

        this._active       = false;
        this._firstUpdate  = true;
        this._prevUpdateTs = this._updateTs = Date.now();

        this._updateMoveDirection_bound = this._updateMoveDirection.bind(this);

        this._avatar = {
            position:      { x: 0, y: 0 },
            moveDirection: { x: 0, y: 0 },
            lookDirection: 0
        };

        this._clients = [];

        container.appendChild(this._canvas);

        this._connect();
    }

    setActive(value) {
        if (this._active === value) {
            return;
        }

        this._active = value;

        this._canvas.classList.toggle('active', value);

        if (value) {
            controller.on('change', this._updateMoveDirection_bound);
            this._updateMoveDirection(controller.getState());
        } else {
            controller.off('change', this._updateMoveDirection_bound);
            this._resetMoveDirection();
        }
    }

    _connect() {
        this._connection.sendMessageToServer('connect');
    }

    _initialize() {
        setInterval(() => {
            this._prevUpdateTs = this._updateTs;
            this._updateTs = Date.now();
            this._update(this._updateTs, this._updateTs - this._prevUpdateTs);
            this._draw();
        }, 1000 / Client.FPS);

        setInterval(() => {
            this._sendUpdate();
        }, 1000 / Client.CMD_UPDATE_RATE);
    }

    _update(ts, timeDelta) {
        const moveDistance = timeDelta * Client.SPEED / 1000;

        this._avatar.position.x += this._avatar.moveDirection.x * moveDistance;
        this._avatar.position.y += this._avatar.moveDirection.y * moveDistance;

        let d = (ts - this._worldUpdateTs) / (1000 / World.RATE);

        if (d > 1) {
            d = 1;
        }

        for (let client of this._clients) {
            client.cur.position.x = client.prev.position.x + (client.last.position.x - client.prev.position.x) * d;
            client.cur.position.y = client.prev.position.y + (client.last.position.y - client.prev.position.y) * d;
        }
    }

    _draw() {
        const ctx = this._canvas.getContext('2d');

        ctx.fillStyle = '#FFF';
        ctx.fillRect(0, 0, Client.CANVAS_WIDTH, Client.CANVAS_HEIGHT);

        this._drawClients(ctx);
        this._drawPlayer(ctx);
    }

    _drawClients(ctx, d) {
        for (let client of this._clients) {
            ctx.save();

            ctx.strokeStyle = '#00F';
            ctx.translate(client.cur.position.x, client.cur.position.y);
            ctx.beginPath();
            ctx.arc(0, 0, Client.AVATAR_R, 0, 2 * Math.PI);
            ctx.stroke();

            ctx.restore();
        }
    }

    _drawPlayer(ctx) {
        ctx.save();

        ctx.strokeStyle = '#000';
        ctx.translate(this._avatar.position.x, this._avatar.position.y);
        ctx.beginPath();
        ctx.arc(0, 0, Client.AVATAR_R, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.sin(this._avatar.direction) * Client.AVATAR_DIRECTION_SIZE, -Math.cos(this._avatar.direction) * Client.AVATAR_DIRECTION_SIZE);
        ctx.stroke();

        ctx.restore();
    }

    _updateMoveDirection(state) {
        const vector = { x: 0, y: 0 };

        if (state['W']) {
            vector.y--;
        }
        if (state['S']) {
            vector.y++;
        }
        if (state['A']) {
            vector.x--;
        }
        if (state['D']) {
            vector.x++;
        }

        if (vector.x && vector.y) {
            vector.x *= SIN_P4;
            vector.y *= SIN_P4;
        }

        this._avatar.moveDirection = vector;
    }

    _resetMoveDirection() {
        this._avatar.moveDirection = { x: 0, y: 0 };
    }

    _sendUpdate() {
        this._connection.sendMessageToServer('updateState', this._avatar.position);
    }

    onServerMessage(eventName, data) {
        switch (eventName) {
            case 'updateWorld': {
                for (let clientModel of data.clients) {
                    if (this._firstUpdate) {
                        if (clientModel.id === this._id) {
                            this._avatar.position = {
                                x: clientModel.position.x,
                                y: clientModel.position.y
                            };
                        } else {
                            this._clients.push({
                                id:   clientModel.id,
                                prev: {
                                    position: clientModel.position
                                },
                                last: {
                                    position: clientModel.position
                                },
                                cur: {
                                    position: _.clone(clientModel.position)
                                }
                            });
                        }
                    } else {
                        // UPDATE
                        for (let client of this._clients) {
                            if (client.id === clientModel.id) {
                                client.prev.position = client.last.position;
                                client.last.position = clientModel.position;
                            }
                        }
                    }
                }

                if (this._firstUpdate) {
                    this._initialize();
                }

                this._firstUpdate   = false;
                this._worldUpdateTs = Date.now();

                break;
            }
            default: {
                console.log('Unknown server event', eventName);
            }
        }
    }

}

Client.CANVAS_WIDTH = 400;
Client.CANVAS_HEIGHT = 200;
Client.AVATAR_R = 20;
Client.AVATAR_DIRECTION_SIZE = 30;

Client.FPS = 60;
Client.CMD_UPDATE_RATE = 30;
Client.ONE_WAY_DELAY = 150;

Client.SPEED = 100;
