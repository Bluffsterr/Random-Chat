let onlineUsers = 0;
let totalConnections = 0;
let totalMatches = 0;
let totalMessages = 0;
let totalReports = 0;

const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Chat system state
let waitingUser = null;
let rooms = new Map();

// Anti-spam controls
const MESSAGE_LIMIT = 200;
const RATE_LIMIT_TIME = 500;
const lastMessageTime = new Map();

// Username generator
function generateName() {
  const animals = ["Tiger", "Fox", "Wolf", "Eagle", "Lion", "Bear", "Shark", "Panda"];
  const num = Math.floor(Math.random() * 100);
  return animals[Math.floor(Math.random() * animals.length)] + num;
}

// Report logger
function logReport(data) {
  const log = `[${new Date().toISOString()}] ${data}\n`;
  fs.appendFileSync("reports.log", log);
}

// Send analytics to all users
function sendStats() {
  io.emit("stats", {
    onlineUsers,
    totalConnections,
    totalMatches,
    totalMessages,
    totalReports,
  });
}

io.on("connection", (socket) => {
  onlineUsers++;
  totalConnections++;
  io.emit("online", onlineUsers);
  sendStats();

  socket.username = generateName();
  socket.emit("yourName", socket.username);

  console.log("Connected:", socket.id, socket.username);

  match(socket);

  // Handle messages
  socket.on("message", (msg) => {
    const room = rooms.get(socket.id);
    if (!room) return;

    const now = Date.now();
    const lastTime = lastMessageTime.get(socket.id) || 0;
    if (now - lastTime < RATE_LIMIT_TIME) return;
    lastMessageTime.set(socket.id, now);

    if (typeof msg !== "string") return;
    if (msg.length > MESSAGE_LIMIT) msg = msg.substring(0, MESSAGE_LIMIT);

    totalMessages++;
    sendStats();

    socket.to(room).emit("message", msg);
  });

  // Typing indicator
  socket.on("typing", () => {
    const room = rooms.get(socket.id);
    if (room) socket.to(room).emit("typing");
  });

  socket.on("stopTyping", () => {
    const room = rooms.get(socket.id);
    if (room) socket.to(room).emit("stopTyping");
  });

  // Skip partner
  socket.on("next", () => {
    leaveRoom(socket);
    match(socket);
  });

  // Report
  socket.on("report", () => {
    const room = rooms.get(socket.id) || "No Room";
    const reportInfo = `REPORT | Reporter: ${socket.username} (${socket.id}) | Room: ${room}`;
    console.log(reportInfo);
    logReport(reportInfo);

    totalReports++;
    sendStats();
  });

  // Disconnect
  socket.on("disconnect", () => {
    onlineUsers--;
    io.emit("online", onlineUsers);
    sendStats();

    lastMessageTime.delete(socket.id);
    leaveRoom(socket);
    if (waitingUser && waitingUser.id === socket.id) waitingUser = null;

    console.log("Disconnected:", socket.id, socket.username);
  });

  function match(sock) {
    if (waitingUser && waitingUser.id !== sock.id) {
      const room = waitingUser.id + "-" + sock.id;
      sock.join(room);
      waitingUser.join(room);

      rooms.set(sock.id, room);
      rooms.set(waitingUser.id, room);

      sock.emit("matched", {
        you: sock.username,
        stranger: waitingUser.username,
      });

      waitingUser.emit("matched", {
        you: waitingUser.username,
        stranger: sock.username,
      });

      totalMatches++;
      sendStats();

      console.log("Matched:", room, sock.username, "↔", waitingUser.username);

      waitingUser = null;
    } else {
      waitingUser = sock;
      sock.emit("waiting");
    }
  }

  function leaveRoom(sock) {
    const room = rooms.get(sock.id);
    if (!room) return;

    rooms.delete(sock.id);
    sock.leave(room);

    const users = io.sockets.adapter.rooms.get(room);
    if (users) {
      users.forEach((id) => {
        const u = io.sockets.sockets.get(id);
        rooms.delete(id);
        u.leave(room);
        u.emit("partnerLeft");
        match(u);
      });
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
