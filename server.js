const path = require('path');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

const app = express();

// Serve static assets in /public and project root (for script.js)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Always serve the main page
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// In-memory room store ➜ { [roomId]: { host: ws, guest: ws|null } }
const rooms = {};

function safeSend(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    // Host creates a room
    if (data.type === 'create_room') {
      const roomId = uuidv4().slice(0, 8);
      rooms[roomId] = { host: ws, guest: null };
      ws.role = 'host';
      ws.roomId = roomId;
      safeSend(ws, { type: 'room_created', roomId });
      return;
    }

    // Guest joins existing room
    if (data.type === 'join_room') {
      const { roomId } = data;
      const room = rooms[roomId];
      if (!room || room.guest) {
        safeSend(ws, { type: 'error', message: 'Room unavailable' });
        return;
      }
      room.guest = ws;
      ws.role = 'guest';
      ws.roomId = roomId;
      safeSend(ws, { type: 'room_joined', roomId });
      safeSend(room.host, { type: 'guest_joined' });
      return;
    }

    // Forward gameplay payloads
    if (data.type === 'state' || data.type === 'input') {
      const room = rooms[ws.roomId];
      if (!room) return;

      if (ws.role === 'host' && data.type === 'state' && room.guest) {
        safeSend(room.guest, data);
      }
      if (ws.role === 'guest' && data.type === 'input' && room.host) {
        safeSend(room.host, data);
      }
    }
  });

  ws.on('close', () => {
    const roomId = ws.roomId;
    if (!roomId) return;
    const room = rooms[roomId];
    if (!room) return;

    if (ws.role === 'host') {
      // Terminate guest and delete room
      if (room.guest) room.guest.close();
      delete rooms[roomId];
    } else if (ws.role === 'guest') {
      room.guest = null;
      safeSend(room.host, { type: 'guest_left' });
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚗 CarBall server listening on ${PORT}`);
});
