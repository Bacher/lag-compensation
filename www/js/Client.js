const SIN_P4 = 0.7071067811865475;

const SMOOTH_TYPE = {
    FIRST_FRAME:            0,
    INTERPOLATION:          1,
    EXTRAPOLATION:          2,
    EXTRA_IN_INTERPOLATION: 3
};

const EXTRAPOLATION_PERIOD = 250; // ms

class Client {

    constructor(container, id) {
        this._id = id;

        this._connection = new ClientConnection(this);

        this._canvas = document.createElement('canvas');
        this._canvas.classList.add('client');
        this._canvas.width  = Client.CANVAS_WIDTH;
        this._canvas.height = Client.CANVAS_HEIGHT;

        this.isActive      = false;
        this._prevUpdateTs = this._updateTs = Date.now();

        this._updateMoveDirection_bound = this._updateMoveDirection.bind(this);
        this._updateMouse_bound         = this._updateMouse.bind(this);
        this._onMouseDown_bound         = this._onMouseDown.bind(this);

        this._lastShootId   = 0;
        this._shooting      = false;
        this._shootingPoint = null;

        this._avatar = {
            index:         0,
            position:      { x: 0, y: 0 },
            moveDirection: { x: 0, y: 0 },
            lookDirection: 0
        };

        this._snapshots = [];
        this._clients   = [];
        this._shoots    = [];
        this._extrapolation = null;

        this._interpolationStartTs = null;
        this._speed = 1;

        this._currentTick = null;
        this._currentIndex = 0;

        this._fps = '';
        this._fpsFramesCount = 0;
        this._fpsStartTs = null;

        this._type = SMOOTH_TYPE.FIRST_FRAME;

        container.appendChild(this._canvas);

        this._connect();
    }

    log(...args) {
        if (this._id === 2) {
            console.log(...args);
        }
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
        this._fpsStartTs = Date.now();

        setInterval(() => {
            this._tick();
        }, 1000 / Client.FPS);

        setInterval(() => {
            this._sendUpdate();
        }, 1000 / Client.CMD_UPDATE_RATE);
    }

    _tick() {
        const now   = Date.now();
        const delta = now - this._prevUpdateTs;

        this._prevUpdateTs = this._updateTs;
        this._updateTs     = now;
        this._updateAvatar(this._updateTs, delta);
        this._update(this._updateTs, delta);
        this._draw();

        if (now - this._fpsStartTs >= 1000) {
            this._fps            = this._fpsFramesCount;
            this._fpsFramesCount = 0;
            this._fpsStartTs += 1000;
        }

        this._fpsFramesCount++;
    }

    _updateAvatar(now, timeDelta) {
        this._avatar.position.x += this._avatar.moveDirection.x * timeDelta * Client.SPEED / 1000;
        this._avatar.position.y += this._avatar.moveDirection.y * timeDelta * Client.SPEED / 1000;
    }

    _processTransition() {
        const now = this._now;

        switch (this._type) {
            case SMOOTH_TYPE.FIRST_FRAME: {
                this._speed = 1;
                this._interpolationStartTs = now;
                this._interpolationEndTs   = now + (1000 / World.TICK_RATE);

                this.log('INTER');
                this._type = SMOOTH_TYPE.INTERPOLATION;

                this._processTransition();

                break;
            }
            case SMOOTH_TYPE.INTERPOLATION: {
                if (now >= this._interpolationEndTs) {
                    this._currentIndex++;

                    // Если в буфере хватает кадров, то просто интерполируем
                    if (this._snapshots.length - this._currentIndex >= 2) {
                        const bufferSize = this._snapshots.length - this._currentIndex;

                        if (bufferSize < 3) {
                            this._speed = 0.9
                        } else if (bufferSize === 3) {
                            this._speed = 1;
                        } else {
                            this._speed = 1.1;
                        }

                        //console.log('new transition, speed:', this._speed);

                        this._interpolationStartTs = this._interpolationEndTs;
                        this._interpolationEndTs   = this._interpolationStartTs + (1000 / World.TICK_RATE) / this._speed;

                        this._processTransition();

                    } else {
                        // Если нет, то переходим в экстраполяцию
                        this.log('EXTRA');

                        this._type = SMOOTH_TYPE.EXTRAPOLATION;
                        this._interpolationStartTs = this._interpolationEndTs;
                        this._interpolationEndTs   = this._interpolationStartTs + EXTRAPOLATION_PERIOD;

                        this._processTransition();
                    }

                } else {
                    if (!this._interpolationStartTs) {
                        debugger
                    }
                    this._d = this._speed * (now - this._interpolationStartTs) / (1000 / World.TICK_RATE);

                    this._curSnapshot  = this._snapshots[this._currentIndex];
                    this._nextSnapshot = this._snapshots[this._currentIndex + 1];
                }

                break;
            }
            case SMOOTH_TYPE.EXTRAPOLATION: {
                // если появились пакеты в буфере, то начинаем переход от экстра- к интерполяции
                if (this._snapshots.length - this._currentIndex >= 2) {
                    this._extrapolation = {
                        clients: this._clients.map(client => _.cloneDeep(client))
                    };

                    this._interpolationStartTs = now;
                    this._interpolationEndTs   = this._interpolationStartTs + (1000 / World.TICK_RATE);
                    // this._d = 0;
                    //
                    // this._curSnapshot  = this._snapshots[this._currentIndex - 1];
                    // this._nextSnapshot = this._snapshots[this._currentIndex];

                    this.log('EXTRA -> INTER');

                    this._type = SMOOTH_TYPE.EXTRA_IN_INTERPOLATION;

                    this._processTransition();

                } else {
                    // Иначе продолжаем экстраполяцию, но не далее 250ms

                    if (now >= this._interpolationEndTs) {
                        this._d = 1 + EXTRAPOLATION_PERIOD / (1000 / World.TICK_RATE);
                    } else {
                        this._d = 1 + (now - this._interpolationStartTs) / (1000 / World.TICK_RATE);
                    }

                    this._curSnapshot  = this._snapshots[this._currentIndex - 1];
                    this._nextSnapshot = this._snapshots[this._currentIndex];
                }
                break;
            }
            case SMOOTH_TYPE.EXTRA_IN_INTERPOLATION: {
                // Если переход завершен, то переходим к интерполяции
                if (now >= this._interpolationEndTs) {
                    this.log('INTER');

                    this._type = SMOOTH_TYPE.INTERPOLATION;

                    // Убавляем индекс для правильной работы интерполяции
                    this._currentIndex--;
                    this._processTransition();

                } else {
                    // В противном случае продолжаем переход
                    this._d = (now - this._interpolationStartTs) / (1000 / World.TICK_RATE);

                    this._curSnapshot  = this._extrapolation;
                    this._nextSnapshot = this._snapshots[this._currentIndex];
                }
                break;
            }
        }
    }

    _update(now, timeDelta) {
        this._now = now;

        this._d = null;
        this._curSnapshot  = null;
        this._nextSnapshot = null;

        this._processTransition();

        if (this._d > 2) {
            debugger
        }

        const d            = this._d;
        const curSnapshot  = this._curSnapshot;
        const nextSnapshot = this._nextSnapshot;

        if (!curSnapshot) {
            debugger
        }

        if (!nextSnapshot) {
            debugger
        }

        for (let i = 0; i < curSnapshot.clients.length; i++) {
            if (i === this._avatar.index) {
                continue;
            }

            const cClient = curSnapshot.clients[i];
            const nClient = nextSnapshot.clients[i];
            let   client  = this._clients[i];

            if (!client) {
                client = this._clients[i] = {
                    id:            cClient.id,
                    position:      _.clone(cClient.position),
                    lookDirection: cClient.lookDirection
                };
            }

            if (!nClient) {
                debugger
            }

            client.position.x = cClient.position.x + (nClient.position.x - cClient.position.x) * d;
            client.position.y = cClient.position.y + (nClient.position.y - cClient.position.y) * d;
            client.lookDirection = cClient.lookDirection + (nClient.lookDirection - cClient.lookDirection) * d;
        }
    }

    _startNextInterpolation(now) {

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

        ctx.save();

        //ctx.strokeStyle = '#000';
        ctx.translate(Client.CANVAS_WIDTH - 20, 20);
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, 2 * Math.PI);

        switch(this._type) {
            case SMOOTH_TYPE.INTERPOLATION:
                ctx.fillStyle = '#0F0';
                break;
            case SMOOTH_TYPE.EXTRAPOLATION:
                ctx.fillStyle = '#F00';
                break;
            case SMOOTH_TYPE.EXTRA_IN_INTERPOLATION:
                ctx.fillStyle = '#00F';
                break;
        }

        ctx.fill();

        ctx.restore();

        ctx.font = '20px Arial';
        ctx.fillStyle = '#000';
        ctx.fillText(`FPS: ${this._fps}`, Client.CANVAS_WIDTH - 100, 20);
    }

    _drawClients(ctx) {
        for (let client of this._clients) {
            if (client.id !== this._id) {
                this._drawGameClient(ctx, client, false);
            }
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
        ctx.lineTo(
            Math.sin(clientModel.lookDirection) * Client.AVATAR_DIRECTION_SIZE,
            -Math.cos(clientModel.lookDirection) * Client.AVATAR_DIRECTION_SIZE
        );
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
            case 'updateWorld':
                //this.log('UP', new Date().toJSON());

                this._snapshots.push(data);

                if (this._snapshots.length === 1) {
                    for (let i = 0; i < data.clients.length; i++) {
                        const clientModel = data.clients[i];

                        if (clientModel.id === this._id) {
                            this._avatar.index         = i;
                            this._avatar.position      = clientModel.position;
                            this._avatar.lookDirection = clientModel.lookDirection;
                        }

                        this._clients.push({
                            id:            clientModel.id,
                            position:      clientModel.position,
                            lookDirection: clientModel.lookDirection
                        });
                    }

                    this._shoots = data.shoots;

                    this._currentTick = data.tick;
                }

                if (this._snapshots.length === 3) {
                    this._initialize();
                }

                break;
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
Client.CMD_UPDATE_RATE = 20;
Client.ONE_WAY_DELAY = 150;

Client.SPEED = 100;
