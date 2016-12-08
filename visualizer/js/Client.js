
class Client {

    constructor() {
        this._canvas = document.createElement('canvas');

        this._canvas.width = WIDTH;
        this._canvas.height = HEIGHT;

        document.querySelector('.views').appendChild(this._canvas);

        this._obj = {
            position:      { x: 0, y: 0 },
            moveDirection: { x: 1, y: 0 }
        };

        this._snapshots = [];
        this._currentIndex = -1;
    }

    start() {
        setInterval(() => {
            this._update();
            this._draw();
        }, 1000 / FPS);

        setInterval(() => {
            this._send();
        }, 1000 / TICK_RATE);
    }

    onServerMessage(message) {
        this._snapshots.push(message);

        if (this._snapshots.length === 20) {
            this._snapshots = this._snapshots.slice(-3);
        }

        this._currentIndex = this._snapshots.length - 1;
    }

    _update() {
        this._obj.position.x += this._obj.moveDirection.x * MOVE_SPEED / FPS;
        this._obj.position.y += this._obj.moveDirection.y * MOVE_SPEED / FPS;
    }

    _draw() {
        const ctx = this._canvas.getContext('2d');

        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        ctx.save();

        ctx.translate(this._obj.position.x, 100 + this._obj.position.y);
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, 2 * Math.PI);
        ctx.fillStyle = '#0F0';
        ctx.fill();

        ctx.restore();
    }

    _send() {
        if (this._snapshots.length === 0) {
            return;
        }

        connection.sendMessageToServer('update', {
            lastFrameId: this._snapshots[this._currentIndex].frameId,
            object:      {
                position:      this._obj.position,
                moveDirection: this._obj.moveDirection,
            }
        });
    }

}
