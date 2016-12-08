class Server {

    constructor() {
        this._canvas = document.createElement('canvas');

        this._canvas.width = WIDTH;
        this._canvas.height   = HEIGHT;

        document.querySelector('.views').appendChild(this._canvas);

        this._snapshotIndex = 0;
        this._snapshotId    = 1;
        this._snapshots     = [{
            snapshotId: this._snapshotId,
            object:     {
                position:      { x: 0, y: 0 },
                moveDirection: { x: 0, y: 0 }
            }
        }];

        this._clientState = {
            delta:         null,
            subDelta:      0
        };

        this._curCommandIndex = -1;
        this._commands = [];
    }

    start() {
        setInterval(() => {
            this._update();
        }, 1000 / TICK_RATE);
    }

    _update() {
        const prevSnapshot = this._snapshots[this._snapshotIndex];

        this._snapshotId++;
        this._snapshotIndex++;

        const newSnapshot = {
            snapshotId: this._snapshotId,
            object:     {
                position: { x: 0, y: 0 },
                moveDirection: { x: 0, y: 0 }
            }
        };

        if (this._clientState.delta === null && this._commands.length) {
            this._clientState.delta = this._snapshotId - this._commands[0].snapshotId;
        }

        const commandsCount = this._commands.length - this._curCommandIndex - 1;
        const command = commandsCount ? this._commands[this._curCommandIndex + 1].object : null;
        const prevCommand = this._commands[this._curCommandIndex].object;

        if (this._clientState.subDelta < 0) {
            if (commandsCount === 0) {
                // ТУТ ПОКА ХЗ
            } else if (commandsCount === 1) {
                this._clientState.subDelta--;

                if (this._clientState.subDelta === -5) {
                    this._clientState.subDelta = 0;
                    this._clientState.delta++;

                    // Рендерим обычный кадр
                    newSnapshot.object.position.x = command.position.x;
                } else {
                    // Экстраполяция с коррекцией
                    if (this._clientState.subDelta === -2) {
                        const x1 = prevSnapshot.object.position.x + mix(prevCommand.moveDirection.x, command.moveDirection.x, 0.7) * 0.8;
                        const x2 = command.position.x + command.moveDirection.x * 0.6 * 0.8;

                        newSnapshot.object.position.x = mix(x1, x2, 0.5);

                    } else if (this._clientState.subDelta === -3) {
                        const x1 = prevSnapshot.object.position.x + mix(prevCommand.moveDirection.x, command.moveDirection.x, 0.5) * 0.8;
                        const x2 = command.position.x + command.moveDirection.x * 0.4 * 0.8;

                        newSnapshot.object.position.x = mix(x1, x2, 0.5);
                    } else if (this._clientState.subDelta === -4) {
                        const x1 = prevSnapshot.object.position.x + mix(prevCommand.moveDirection.x, command.moveDirection.x, 0.3) * 0.8;
                        const x2 = command.position.x + command.moveDirection.x * 0.4 * 0.8;

                        newSnapshot.object.position.x = mix(x1, x2, 0.5);
                    }
                }
            }
        } else if (this._clientState.subDelta > 0) {

        } else {
            if (commandsCount === 0) {
                this._clientState.subDelta--;

                // Экстраполяция 80%
                newSnapshot.object.position.x = prevSnapshot.object.position.x + prevSnapshot.object.moveDirection.x * 0.8;
                newSnapshot.object.position.y = prevSnapshot.object.position.y + prevSnapshot.object.moveDirection.y * 0.8;

            } else if (commandsCount === 1) {
                // Норма

            } else {
                // -------
            }
        }



        if (commandsCount === 0) {
            this._clientState.subDelta--;
        } else {
            if (commandsCount > 1) {
                this._clientState.subDelta++;
            }

            this._curCommandIndex++;

            const command = this._commands[this._curCommandIndex];

            if (!command) {
                debugger
            }

            newSnapshot.object.position.x = command.object.position.x;
            newSnapshot.object.position.y = command.object.position.y;
            newSnapshot.object.moveDirection.x = command.object.moveDirection.x;
            newSnapshot.object.moveDirection.y = command.object.moveDirection.y;
        }

        if (this._commands.length === 0) {

        } else {
            if (this._commands.length > 1) {
                this._clientState.subDelta += 0.2;
            }
        }

        this._snapshots.push(newSnapshot);

        this._draw();

        connection.sendMessageToClient('snapshot', this._snapshots[this._snapshots.length - 1]);
    }

    _draw() {
        const ctx = this._canvas.getContext('2d');

        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        ctx.save();

        const snap = this._getLastSnapshot();

        if (!snap) {
            debugger
        }

        ctx.translate(snap.object.position.x, 100 + snap.object.position.y);
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, 2 * Math.PI);
        ctx.fillStyle = '#0F0';
        ctx.fill();

        ctx.restore();

        if (this._snapshotId % 2 === 0) {
            ctx.beginPath();
            ctx.arc(8, 8, 8, 0, 2 * Math.PI);

            ctx.fillStyle = '#0F0';
            ctx.fill();
        }
    }

    onMessage(message, data) {
        this._commands.push(data);
    }

    _getLastSnapshot() {
        return this._snapshots[this._snapshotIndex];
    }

}

function mix(v1, v2, m) {
    return v1 + (v2 - v1) * m;
}
