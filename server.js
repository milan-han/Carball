import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Express static server ---
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));
const httpServer = createServer(app);

// --- WebSocket server ---
const wss = new WebSocketServer({ server: httpServer });

// Game state storage
const rooms = new Map(); // roomId -> { players: [ws1, ws2], gameState: {...} }

function broadcast(roomId, msg, excludeWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  room.players.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  });
}

function createRoom(roomId) {
  return {
    players: [],
    gameState: {
      ball: { x: 400, y: 300, vx: 0, vy: 0 },
      player1: { x: 100, y: 300, vx: 0, vy: 0, heading: 0 },
      player2: { x: 700, y: 300, vx: 0, vy: 0, heading: Math.PI },
      scoreP1: 0,
      scoreP2: 0,
      celebrating: false,
      gameStarted: false
    },
    lastUpdate: Date.now()
  };
}

wss.on('connection', (ws) => {
  let roomId = null;
  let playerIndex = -1;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      
      switch (msg.type) {
        case 'join':
          roomId = msg.roomId;
          let room = rooms.get(roomId);
          
          if (!room) {
            room = createRoom(roomId);
            rooms.set(roomId, room);
          }
          
          if (room.players.length < 2) {
            playerIndex = room.players.length;
            room.players.push(ws);
            
            // Send join acknowledgment
            ws.send(JSON.stringify({
              type: 'joinAck',
              playerIndex: playerIndex,
              gameState: room.gameState
            }));
            
            // Notify other players
            broadcast(roomId, {
              type: 'playerJoined',
              playerIndex: playerIndex,
              totalPlayers: room.players.length
            }, ws);
            
            console.log(`Player ${playerIndex} joined room ${roomId} (${room.players.length}/2)`);
          } else {
            ws.send(JSON.stringify({ type: 'roomFull' }));
          }
          break;
          
        case 'input':
          if (roomId && playerIndex !== -1) {
            const room = rooms.get(roomId);
            if (room) {
              // Broadcast input to other players
              broadcast(roomId, {
                type: 'playerInput',
                playerIndex: playerIndex,
                input: msg.input
              }, ws);
            }
          }
          break;
          
        case 'playerReady':
          if (roomId && playerIndex !== -1) {
            const room = rooms.get(roomId);
            if (room) {
              // Broadcast ready state to other players
              broadcast(roomId, {
                type: 'playerReady',
                playerIndex: playerIndex,
                ready: msg.ready
              }, ws);
            }
          }
          break;
          
        case 'gameState':
          if (roomId && playerIndex === 0) { // Only host can update game state
            const room = rooms.get(roomId);
            if (room) {
              room.gameState = { ...room.gameState, ...msg.state };
              room.lastUpdate = Date.now();
              
              // Broadcast state to other players
              broadcast(roomId, {
                type: 'stateUpdate',
                state: room.gameState
              }, ws);
            }
          }
          break;
          
        case 'startGame':
          if (roomId && playerIndex === 0) { // Only host can start game
            const room = rooms.get(roomId);
            if (room && room.players.length === 2) {
              room.gameState.gameStarted = true;
              broadcast(roomId, {
                type: 'gameStarted'
              });
            }
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        // Remove player from room
        const index = room.players.indexOf(ws);
        if (index !== -1) {
          room.players.splice(index, 1);
          console.log(`Player ${playerIndex} left room ${roomId} (${room.players.length}/2)`);
          
          // Notify remaining players
          broadcast(roomId, {
            type: 'playerLeft',
            playerIndex: playerIndex,
            totalPlayers: room.players.length
          });
          
          // Clean up empty rooms
          if (room.players.length === 0) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} deleted (empty)`);
          }
        }
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Clean up inactive rooms periodically
setInterval(() => {
  const now = Date.now();
  const ROOM_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastUpdate > ROOM_TIMEOUT) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (inactive)`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
  console.log(`🚗 CarBall server running on http://localhost:${PORT}`);
  console.log(`📊 Active rooms: ${rooms.size}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 