import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Server } from 'http';
import { Socket } from 'net';
import { v4 as uuid } from 'uuid';
import Keyv from 'keyv';
import { KeyvFsStore } from 'keyv-jetpack';

const store = new Keyv({ store: new KeyvFsStore() });

const app = express();
const port = 3000;
const server = new Server(app);

// Add middleware
app.use(bodyParser.json());
app.use(cors());

// Define API endpoints
app.post('/rooms', async (req, res) => {
  const roomId = await createRoom(req.body);
  res.send({ roomId });
});

app.get('/rooms/:id', async (req, res) => {
  const room = await getRoom(req.params.id);
  res.send(room);
});

app.delete('/rooms/:id', async (req, res) => {
  await stopRoom(req.params.id);
  res.sendStatus(204);
});

app.get('/status', (req, res) => {
  res.send(Array.from(subscribers.entries()).reduce((prev: any, [roomId, sockets]) => {
    prev[roomId] = sockets.size;
    return prev;
  }, {}));
});

// Define Server-Sent Events server
interface UserSocket extends Socket {
  username?: string;
}

const subscribers: Map<string, Set<UserSocket>> = new Map();
const users: Map<string, Set<string>> = new Map();

app.get('/events/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  const username = getUsernameFromQueryParams(req.url);

  if (!subscribers.has(roomId)) {
    subscribers.set(roomId, new Set());
  }

  // Configure headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Add the socket to the subscribers list and handle incoming data/disconnects
  server.on('connection', (socket: UserSocket) => {
    socket.on('data', (data) => {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'init':
          if (username) {
            users.get(roomId)?.add(username);
            socket.username = username;
          }
          break;
        case 'update':
          broadcastUpdate(roomId, message.payload, socket.username);
          break;
        default:
          console.log(`Unknown message type received: ${message.type}`);
      }
    });

    // Handle client disconnects
    socket.on('close', () => {
      subscribers.get(roomId)?.delete(socket);

      if (socket.username) {
        users.get(roomId)?.delete(socket.username);
      }
    });
  });
});


// Get username from query parameters
function getUsernameFromQueryParams(url: string): string | null {
  const urlParts = new URLSearchParams(url.split('?')[1]);
  return urlParts.get('username');
}

// Implement CRUD operations for data storage
async function createRoom(data: any): Promise<string> {
  // Create a new room with the provided data and store it in the database
  const roomId = uuid();
  await saveRoom(roomId, data);
  return roomId;
}

async function getRoom(id: string): Promise<any> {
  // Retrieve the current state of a room by ID from the database
  const room = await loadRoom(id);
  return room;
}

async function saveRoom(id: string, data: any) {
  await store.set(id, data);
}

async function loadRoom(id: string) {
  return await store.get(id);
}

async function stopRoom(id: string) {
  subscribers.delete(id);
  users.delete(id);
  await store.clear();
}

function broadcastUpdate(roomId: string, payload: any, username?: string) {
  const sockets = subscribers.get(roomId);
  if (sockets) {
    for (const socket of sockets) {
      // Send update to all clients except the one who sent the update
      if (socket.username !== username) {
        socket.write(`data: ${JSON.stringify({ type: 'update', payload })}\n\n`);
      }
    }
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
