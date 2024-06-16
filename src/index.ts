import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Response } from 'express';
import { v4 as uuid } from 'uuid';
import Keyv from 'keyv';
import { KeyvFsStore } from 'keyv-jetpack';

const store = new Keyv({ store: new KeyvFsStore() });

const app = express();
const port = process.env.PORT || 3000;

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

app.post('/rooms/:id/data', async (req, res) => {
  console.log('/rooms/:id/data');
  const roomId = req.params.id;
  const { data, username } = req.body;
  await saveRoom(roomId, data);
  broadcastUpdate(roomId, data, username);
  res.sendStatus(200);
});



app.get('/status', (req, res) => {
  res.send(Array.from(subscribers.entries()).reduce((prev: any, [roomId, sockets]) => {
    prev[roomId] = sockets.size;
    return prev;
  }, {}));
});

// Define Server-Sent Events server
interface UserSocket extends Response {
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

  if (!users.has(roomId)) {
    users.set(roomId, new Set());
  }


  // Configure headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const sockets = subscribers.get(roomId) as Set<UserSocket>;
  sockets.add(res);

  if (username) {
    (users.get(roomId) as Set<string>).add(username);
    (res as unknown as UserSocket).username = username;
  }

  // Handle client disconnects
  req.on('close', () => {
    sockets.delete(res);
    if (username) {
      (users.get(roomId) as Set<string>).delete(username);
    }
  });
});


// Get username from query parameters
function getUsernameFromQueryParams(url: string): string | null {
  const urlParts = new URLSearchParams(url.split('?')[1]);
  const username = urlParts.get('username');
  console.log(`processed url: ${url}`);
  console.log(`Parsed username: ${username}`);
  return username;
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
  await store.delete(id)
}

function broadcastUpdate(roomId: string, payload: any, username: string) {
  const sockets = subscribers.get(roomId);
  if (sockets) {
    for (const socket of sockets) {
      // Send update to all clients except the one who sent the update
      console.log('emitter username :'+ username);
    
      if (socket.username !== username) {
        console.log('boardcast to '+ socket.username);
        socket.write(`data: ${JSON.stringify({ type: 'update', payload , username})}\n\n`);
      }
    }
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
