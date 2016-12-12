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
        if (this._commands.length === 0) {
            this._snapshots.push({
                snapshotId: this._snapshotId,
                object:     {
                    position: { x: 0, y: 0 },
                    moveDirection: { x: 0, y: 0 }
                }
            });

            this._draw();

            connection.sendMessageToClient('snapshot', this._snapshots[this._snapshots.length - 1]);

            return;
        }

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

        if (this._clientState.delta === null) {
            this._clientState.delta = newSnapshot.snapshotId - this._commands[0].snapshotId;
        }

        const commandsCount = this._commands.length - this._curCommandIndex - 1;
        const command       = commandsCount ? this._commands[this._curCommandIndex + 1].object : null;
        const prevCommand   = this._curCommandIndex !== -1 ? this._commands[this._curCommandIndex].object : null;
        const nextCommand   = commandsCount >= 2 ? this._commands[this._curCommandIndex + 2].object : null;
        const lastCommand   = this._commands[this._commands.length - 1];
        // больше нуля - спешат, меньше нуля - задерживаются
        const ppDelta       = this._clientState.delta - (newSnapshot.snapshotId - lastCommand.snapshotId);

        if (ppDelta < 0 || this._clientState.subDelta < 0) {
            if (commandsCount === 0) {
                // ТУТ ПОКА ХЗ
                // Жопа, продолжаем экстраполировать и замедляемся
                // У идеале тут уже надо начинать применять экстраполированные данные к пользователю (сопротивляться его вводу)

                if (this._clientState.subDelta === -4) {
                    this._clientState.subDelta = 0;
                    this._clientState.delta++;
                }

                newSnapshot.object.position.x = prevSnapshot.object.position.x + prevCommand.moveDirection.x * 0.8;

            } else {
                this._curCommandIndex++;

                if (commandsCount === 1 && this._clientState.subDelta === -4) {
                    this._clientState.subDelta = 0;
                    this._clientState.delta++;

                    // Рендерим обычный кадр
                    newSnapshot.object.position.x = command.position.x;

                } else {
                    if (commandsCount === 1) {
                        // находимся в задержке, приближаемся к концу замедления
                        this._clientState.subDelta--;
                    } else {
                        // имеем избыток команд, но находимся в экстраполяции
                        // уменьшаем отрыв
                        this._clientState.subDelta++;
                    }

                    // Экстраполяция с запозданием (* 0.2 = * 2 / 10)
                    newSnapshot.object.position.x = command.position.x + command.moveDirection.x * (1 + this._clientState.subDelta * 0.2) * 0.8;
                }
            }
        } else if (ppDelta > 0 || this._clientState.subDelta > 0) {
            if (commandsCount >= 2) {
                this._curCommandIndex++;

                if (this._clientState.subDelta === 4) {
                    this._clientState.subDelta = 0;
                    this._clientState.delta--;

                    this._curCommandIndex++;

                    newSnapshot.object.position.x = nextCommand.position.x;

                } else {
                    this._clientState.subDelta++;

                    newSnapshot.object.position.x = mix(command.position.x, nextCommand.position.x, this._clientState.subDelta * 0.2);
                }
            } else if (commandsCount === 1) {
                this._curCommandIndex++;

                if (this._clientState.subDelta === -4) {
                    this._clientState.subDelta = 0;
                    this._clientState.delta++;

                    newSnapshot.object.position.x = command.position.x;
                } else {
                    this._clientState.subDelta--;

                    newSnapshot.object.position.x = command.position.x + lastCommand.moveDirection.x * this._clientState.subDelta * 0.2;
                }

            } else {
                // Нет команд
                if (this._clientState.subDelta === -4) {
                    this._clientState.subDelta = 0;
                    this._clientState.delta++;

                } else {
                    this._clientState.subDelta--;
                }

                newSnapshot.object.position.x = prevSnapshot.object.position.x + lastCommand.moveDirection.x * 0.8;
            }

        } else {
            if (commandsCount === 0) {
                this._clientState.subDelta--;

                // Экстраполяция 80%
                newSnapshot.object.position.x = prevSnapshot.object.position.x + lastCommand.moveDirection.x * 0.8;

            } else if (commandsCount === 1) {
                // Норма
                newSnapshot.object.position.x = command.position.x;

            } else {
                this._clientState.subDelta++;

                newSnapshot.object.position.x = mix(command.position.x, nextCommand.position.x, this._clientState.subDelta * 0.2);
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
