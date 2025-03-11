import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/user.routes.js";

const app = express();
const server = createServer(app);
const io = connectToSocket(server);

app.set("port", process.env.PORT || 9000);
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.use("/api/v1/users", userRoutes);

app.get("/", (req, res) => {
  return res.json({ hello: "world" });
});

const start = async () => {
  app.set("mongo_user");
  const connectionDb = await mongoose.connect("mongodb+srv://jainparth177:parth177@parthconnectcluster.yh3dl.mongodb.net/?retryWrites=true&w=majority&appName=ParthConnectCluster");

  console.log(`connected to db host ${connectionDb.connection.host}`);
  server.listen(app.get("port"), () => {
    console.log("Working on port 9000");
  });
};

start();
