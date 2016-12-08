const WIDTH = 800;
const HEIGHT = 200;

const TICK_RATE = 20;
const FPS = 60;

const MOVE_SPEED = 100;

window.connection = new ClientConnection();

window.server = new Server();
window.server.start();


window.client = new Client();
window.client.start();
