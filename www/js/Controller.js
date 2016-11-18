const KEY_CODES = new Map();

KEY_CODES.set(87, 'W');
KEY_CODES.set(83, 'S');
KEY_CODES.set(65, 'A');
KEY_CODES.set(68, 'D');

class Controller {

    constructor() {
        this._addKeyboardListener();

        this._state = {};

        this._callbacks = {
            'keydown': [],
            'keyup':   [],
            'change':  []
        };
    }

    _addKeyboardListener() {
        document.addEventListener('keydown', e => {
            const key = KEY_CODES.get(e.which);

            if (key) {
                this._state[key] = true;

                for (let callback of this._callbacks['keydown']) {
                    callback(key, this._state);
                }

                for (let callback of this._callbacks['change']) {
                    callback(this._state);
                }
            }
        });

        document.addEventListener('keyup', e => {
            const key = KEY_CODES.get(e.which);

            if (key) {
                delete this._state[key];

                for (let callback of this._callbacks['keyup']) {
                    callback(key, this._state);
                }

                for (let callback of this._callbacks['change']) {
                    callback(this._state);
                }
            }
        });
    }

    getState() {
        return this._state;
    }

    on(type, callback) {
        const callbacks = this._callbacks[type];

        if (callbacks.includes(callback)) {
            throw new Error('Callback already listening');
        } else {
            callbacks.push(callback);
        }
    }

    off(type, callback) {
        const callbacks = this._callbacks[type];
        const index     = callbacks.indexOf(callback);

        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    }

}
