require("dotenv").config();
const express = require("express");
const connectDB = require("./config/dbConfig"); // yoki ./utils/connect

const cors = require("cors");
const PORT = process.env.PORT || 5050;
const notfound = require("./middleware/notfound.middleware");
const router = require("./routes/router");
const authMiddleware = require("./middleware/AuthMiddleware");
const { createServer } = require("node:http");
const soket = require("./socket");

const app = express();
const server = createServer(app);
const io = require("./middleware/socket.header")(server);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CORS sozlamalari
const corsOptions = {
  origin: "*", // Allows all origins
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
};
app.use(cors(corsOptions));

(async () => {
  await connectDB();
})();

app.set("socket", io);
soket.connect(io);

app.use("/api", authMiddleware, router); // Routerlarni ulash
app.get("/", (req, res) => res.send("Polizol Server API")); // Bosh sahifa
app.use(notfound); // 404 middleware

server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
