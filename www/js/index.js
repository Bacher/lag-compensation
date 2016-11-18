const server     = new Server();
const controller = new Controller();

const root = document.querySelector('.clients');

const cl1 = new Client(root, 1);
const cl2 = new Client(root, 2);

root.addEventListener('click', e => {
    if (e.target === cl1._canvas) {
        cl1.setActive(true);
        cl2.setActive(false);
    } else if (e.target === cl2._canvas) {
        cl1.setActive(false);
        cl2.setActive(true);
    } else {
        cl1.setActive(false);
        cl2.setActive(false);
    }
});

cl1.setActive(true);

const clients = new Map();
clients.set(1, cl1);
clients.set(2, cl2);
