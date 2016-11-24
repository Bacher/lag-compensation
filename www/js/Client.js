const SIN_P4 = 0.7071067811865475;

class Client {

    constructor(container, id) {
        this._id = id;

        this._connection = new ClientConnection(this);

        this._canvas = document.createElement('canvas');
        this._canvas.classList.add('client');
        this._canvas.width  = Client.CANVAS_WIDTH;
        this._canvas.height = Client.CANVAS_HEIGHT;

        this.isActive      = false;
        this._firstUpdate  = true;
        this._prevUpdateTs = this._updateTs = Date.now();

        this._updateMoveDirection_bound = this._updateMoveDirection.bind(this);
        this._updateMouse_bound         = this._updateMouse.bind(this);
        this._onMouseDown_bound         = this._onMouseDown.bind(this);

        this._shooting = false;
        this._shootingPoint = null;

        this._updateCmdRemains = 0;
        this._updateEvery = 1000 / Client.CMD_UPDATE_RATE;

        this._avatar = {
            position:      { x: 0, y: 0 },
            moveDirection: { x: 0, y: 0 },
            lookDirection: 0
        };

        this._clients = [];
        this._shoots  = [];

        container.appendChild(this._canvas);

        this._connect();
    }

    setActive(value) {
        if (this.isActive === value) {
            return;
        }

        this.isActive = value;

        this._canvas.classList.toggle('active', value);

        if (value) {
            controller.on('change', this._updateMoveDirection_bound);
            controller.on('mousemove', this._updateMouse_bound);
            controller.on('mousedown', this._onMouseDown_bound);
            this._updateMoveDirection(controller.getState());
        } else {
            controller.off('change', this._updateMoveDirection_bound);
            controller.off('mousemove', this._updateMouse_bound);
            controller.off('mousedown', this._onMouseDown_bound);
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
    }

    _update(ts, timeDelta) {
        let needSendUpdate = false;

        if (this._updateCmdRemains <= 0) {
            needSendUpdate = true;
            this._updateCmdRemains = this._updateEvery;
        } else {
            this._updateCmdRemains -= timeDelta;
        }

        if (needSendUpdate && this._shooting) {
            this._shootingLine = {
                from: { x: this._avatar.position.x, y: this._avatar.position.y },
                to:   this._shootingPoint
            };
        }

        const moveDistance = timeDelta * Client.SPEED / 1000;

        this._avatar.position.x += this._avatar.moveDirection.x * moveDistance;
        this._avatar.position.y += this._avatar.moveDirection.y * moveDistance;

        let d = (ts - this._worldUpdateTs) / (1000 / World.TICK_RATE);

        if (d > 1.25) {
            d = 1.25;
        }

        for (let client of this._clients) {
            client.cur.position.x    = client.prev.position.x + (client.last.position.x - client.prev.position.x) * d;
            client.cur.position.y    = client.prev.position.y + (client.last.position.y - client.prev.position.y) * d;
            client.cur.lookDirection = client.prev.lookDirection + (client.last.lookDirection - client.prev.lookDirection) * d;
        }

        if (needSendUpdate) {
            this._sendUpdate();
        }
    }

    _draw() {
        const ctx = this._canvas.getContext('2d');

        ctx.fillStyle = '#FFF';
        ctx.fillRect(0, 0, Client.CANVAS_WIDTH, Client.CANVAS_HEIGHT);

        this._drawClients(ctx);
        this._drawPlayer(ctx);
        this._drawShoots(ctx);
        this._drawMyShootingLine(ctx);
        this._drawRealClientsPositions(ctx);
        this._drawServerClientsPositions(ctx);
    }

    _drawClients(ctx) {
        for (let client of this._clients) {
            this._drawGameClient(ctx, client.cur, false);
        }
    }

    _drawGameClient(ctx, clientModel, isPlayer) {
        ctx.save();

        ctx.strokeStyle = '#000';
        ctx.translate(clientModel.position.x, clientModel.position.y);
        ctx.beginPath();
        ctx.arc(0, 0, Client.AVATAR_R, 0, 2 * Math.PI);

        if (isPlayer) {
            ctx.fillStyle = '#C0FFB6';
            ctx.fill();
        }

        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.sin(clientModel.lookDirection) * Client.AVATAR_DIRECTION_SIZE, -Math.cos(clientModel.lookDirection) * Client.AVATAR_DIRECTION_SIZE);
        ctx.stroke();

        ctx.restore();
    }

    _drawPlayer(ctx) {
        this._drawGameClient(ctx, this._avatar, true);
    }

    _drawShoots(ctx) {
        for (let shoot of this._shoots) {
            this._drawShootingLine(ctx, shoot, '#00F');
        }
    }

    _drawMyShootingLine(ctx) {
        if (this._shootingLine) {
           this._drawShootingLine(ctx, this._shootingLine);
        }
    }

    _drawShootingLine(ctx, shoot, color) {
        ctx.strokeStyle = color || '#F00';
        ctx.beginPath();
        ctx.moveTo(shoot.from.x, shoot.from.y);
        ctx.lineTo(shoot.to.x, shoot.to.y);
        ctx.stroke();
    }

    _drawRealClientsPositions(ctx) {
        for (let [id, client] of clients) {
            if (id !== this._id) {
                this._drawCross(ctx, client._avatar.position, '#777');
            }
        }
    }

    _drawServerClientsPositions(ctx) {
        for (let client of server.getClientsPositions()) {
            this._drawCross(ctx, client.position, '#0F0');
        }
    }

    _drawCross(ctx, position, color) {
        ctx.save();

        ctx.translate(position.x, position.y);

        // ctx.beginPath();
        // ctx.strokeStyle = color;
        // ctx.lineWidth = 2;
        // ctx.moveTo(-10, 0);
        // ctx.lineTo(10, 0);
        // ctx.moveTo(0, -10);
        // ctx.lineTo(0, 10);
        // ctx.stroke();

        ctx.strokeStyle = '#000';
        ctx.fillStyle = color;

        ctx.beginPath();
        ctx.rect(-8, -1, 16, 2);
        ctx.stroke();
        ctx.rect(-1, -8, 2, 16);
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(-8, -1, 16, 2);
        ctx.fill();
        ctx.rect(-1, -8, 2, 16);
        ctx.fill();

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

    _updateMouse(absolutePoint, target) {
        if (target === this._canvas) {
            const point = this._getLocalCoordinates(absolutePoint);

            // Инвертируем, так как в canvas
            const dx = point.x - this._avatar.position.x;
            const dy = point.y - this._avatar.position.y;

            let angle = -Math.atan(dx / dy);

            if (dy > 0) {
                angle += Math.PI;
            }

            this._avatar.lookDirection = angle;
        }
    }

    _onMouseDown(absolutePoint, target) {
        if (target === this._canvas) {
            this._shooting      = true;
            this._shootingPoint = this._getLocalCoordinates(absolutePoint);
        }
    }

    _getLocalCoordinates(absolutePoint) {
        return {
            x: absolutePoint.x - this._canvas.offsetLeft,
            y: absolutePoint.y - this._canvas.offsetTop
        };
    }

    _resetMoveDirection() {
        this._avatar.moveDirection = { x: 0, y: 0 };
    }

    _sendUpdate() {
        const commands = [];

        if (this._shooting) {
            commands.push({
                type: 'shoot',
                to:   this._shootingPoint
            });
        }

        this._connection.sendMessageToServer('updateState', {
            position:      this._avatar.position,
            lookDirection: this._avatar.lookDirection,
            commands:      commands
        });

        if (this._shooting) {
            this._shooting = false;
        }
    }

    onServerMessage(eventName, data) {
        switch (eventName) {
            case 'updateWorld': {
                for (let clientModel of data.clients) {
                    if (this._firstUpdate) {
                        if (clientModel.id === this._id) {
                            this._avatar.position      = clientModel.position;
                            this._avatar.lookDirection = clientModel.lookDirection;
                        } else {
                            this._clients.push({
                                id:   clientModel.id,
                                prev: {
                                    position:      clientModel.position,
                                    lookDirection: clientModel.lookDirection
                                },
                                cur:  {
                                    position:      _.clone(clientModel.position),
                                    lookDirection: clientModel.lookDirection
                                },
                                last: {
                                    position:      clientModel.position,
                                    lookDirection: clientModel.lookDirection
                                }
                            });
                        }
                    } else {
                        // UPDATE
                        for (let client of this._clients) {
                            if (client.id === clientModel.id) {
                                client.prev = client.last;
                                client.last = {
                                    position:      clientModel.position,
                                    lookDirection: clientModel.lookDirection
                                };
                            }
                        }
                    }
                }

                this._shoots = [];

                for (let shoot of data.shoots) {
                    this._shoots.push(shoot);
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
Client.CMD_UPDATE_RATE = 33;
Client.ONE_WAY_DELAY = 150;

Client.SPEED = 100;
