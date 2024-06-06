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
app.post('/sessions', async (req, res) => {
  const sessionId = await createSession(req.body);
  res.send({ sessionId });
});

app.get('/sessions/:id', async (req, res) => {
  const session = await getSession(req.params.id);
  res.send(session);
});

app.get('/status', (req, res) => {
  res.send(Array.from(subscribers.entries()).reduce((prev: any, [sessionId, sockets]) => {
    prev[sessionId] = sockets.size;
    return prev;
  }, {}));
});

// Define Server-Sent Events server
interface UserSocket extends Socket {
  username?: string;
}

const subscribers: Map<string, Set<UserSocket>> = new Map();
const users: Map<string, Set<string>> = new Map();

server.on('connection', (socket: UserSocket, req: { url: string; }) => {
  console.log(`Client connected to SSE server`);
  const sessionId = req.url?.split('/')[2];
  const username = getUsernameFromQueryParams(req.url);

  // Add client to subscribers list
  if (!subscribers.has(sessionId)) {
    subscribers.set(sessionId, new Set());
  }
  subscribers.get(sessionId)?.add(socket);

  // Handle incoming data
  socket.on('data', (data) => {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'init':
        if (username) {
          users.get(sessionId)?.add(username);
          socket.username = username;
        }
        break;
      case 'update':
        broadcastUpdate(sessionId, message.payload, socket.username);
        break;
      default:
        console.log(`Unknown message type received: ${message.type}`);
    }
  });

  // Handle client disconnects
  socket.on('close', () => {
    console.log(`Client disconnected from SSE server`);
    subscribers.get(sessionId)?.delete(socket);

    if (socket.username) {
      users.get(sessionId)?.delete(socket.username);
    }
  });
});

// Get username from query parameters
function getUsernameFromQueryParams(url: string): string | null {
  const urlParts = new URLSearchParams(url.split('?')[1]);
  return urlParts.get('username');
}

// Implement CRUD operations for data storage
async function createSession(data: any): Promise<string> {
  // Create a new session with the provided data and store it in the database
  const sessionId = uuid();
  await saveSession(sessionId, data);
  return sessionId;
}

async function getSession(id: string): Promise<any> {
  // Retrieve the current state of a session by ID from the database
  const session = await loadSession(id);
  return session;
}

async function saveSession(id: string, data: any) {
  await store.set(id, data);
}

async function loadSession(id: string) {
  return await store.get(id);
}

function broadcastUpdate(sessionId: string, payload: any, username?: string) {
  const sockets = subscribers.get(sessionId);
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
