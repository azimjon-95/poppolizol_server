const io = require("socket.io-client");
const socket = io("http://localhost:5173", {
  transports: ["websocket"],
});
// log
class SocketService {
  // get users
  async getUsers(params) {
    return new Promise(async (resolve, reject) => {});
  }
}

module.exports = new SocketService();
