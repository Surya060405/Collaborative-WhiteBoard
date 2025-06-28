const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Per-room and per-user histories
const roomHistories = {};     // { roomId: { userId: Stroke[][] } }
const roomRedoStacks = {};    // { roomId: { userId: Stroke[][] } }

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;

    // Initialize room and user state
    if (!roomHistories[roomId]) roomHistories[roomId] = {};
    if (!roomRedoStacks[roomId]) roomRedoStacks[roomId] = {};
    roomHistories[roomId][socket.id] = [];
    roomRedoStacks[roomId][socket.id] = [];

    // Assign random pen color to user
    const color = getRandomColor();
    socket.emit("assign_color", color);

    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on("drawing", (data) => {
    const roomId = socket.roomId;
    const userId = socket.id;
    if (!roomId) return;

    const { x0, y0, x1, y1, color, width } = data;
    const stroke = { x0, y0, x1, y1, color, width };

    // Append stroke
    const userHistory = roomHistories[roomId][userId] || [];
    const lastStroke = userHistory[userHistory.length - 1];

    if (!lastStroke || !Array.isArray(lastStroke)) {
      roomHistories[roomId][userId].push([stroke]);
    } else {
      lastStroke.push(stroke);
    }

    // Reset redo stack on new drawing
    roomRedoStacks[roomId][userId] = [];

    // Broadcast to others in the room
    socket.to(roomId).emit("drawing", { ...stroke, userId });
  });

  socket.on("undo", () => {
    const roomId = socket.roomId;
    const userId = socket.id;

    const userHistory = roomHistories[roomId]?.[userId];
    const redoStack = roomRedoStacks[roomId]?.[userId];

    if (userHistory?.length > 0) {
      const popped = userHistory.pop();
      redoStack.push(popped);
      io.to(roomId).emit("user_undo", { userId });
    }
  });

  socket.on("redo", () => {
    const roomId = socket.roomId;
    const userId = socket.id;

    const userHistory = roomHistories[roomId]?.[userId];
    const redoStack = roomRedoStacks[roomId]?.[userId];

    if (redoStack?.length > 0) {
      const stroke = redoStack.pop();
      userHistory.push(stroke);
      io.to(roomId).emit("user_redo", { userId, stroke });
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;

    if (roomId) {
      delete roomHistories[roomId][socket.id];
      delete roomRedoStacks[roomId][socket.id];

      // Optional: clean up empty room
      if (
        Object.keys(roomHistories[roomId]).length === 0 &&
        Object.keys(roomRedoStacks[roomId]).length === 0
      ) {
        delete roomHistories[roomId];
        delete roomRedoStacks[roomId];
      }
    }

    console.log("Client disconnected:", socket.id);
  });
});

function getRandomColor() {
  const colors = [
    "#e6194B", "#3cb44b", "#ffe119", "#4363d8",
    "#f58231", "#911eb4", "#46f0f0", "#f032e6",
    "#bcf60c", "#fabebe"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

server.listen(5000, () => {
  console.log("Server is running on port 5000");
});
