Collaborative Sessions Application
==================================

This is a simple server-side application for managing collaborative sessions with real-time updates using Server-Sent Events (SSE) without managing conflicts. The application allows users to create and join sessions, and see updates from other users in real-time.

Prerequisites
-------------

* Node.js installed on your system
* A package manager like npm or yarn

Getting Started
---------------

1. Clone this repository to your local machine.
2. Run `npm install` or `yarn install` in the project directory to install dependencies.
3. Create a `.env` file in the project root and add the following environment variables:
   ```
   PORT=3000
   DATA_DIR=./data
   ```
4. Run `npm start` or `yarn start` in the project directory to start the server. The server will listen on port 3000 by default.

API Endpoints
-------------

* `POST /sessions`: Create a new collaborative session with the provided data and store it in the database. Returns the ID of the newly created session.
* `GET /sessions/:id`: Retrieve the current state of a session by ID from the database.
* `GET /status`: Get the status of all sessions, including the number of connected clients for each session.

Server-Sent Events (SSE)
------------------------

The application uses Server-Sent Events (SSE) to broadcast real-time updates to all connected clients in a collaborative session. To connect to an SSE endpoint, use a URL like `http://localhost:3000/events/{sessionId}?username={username}`. Replace `{sessionId}` with the ID of the session you want to join, and `{username}` with a simple username for the client.

When a client connects to an SSE endpoint, it sends an "init" message with its username to the server. The server then adds the client to the list of connected clients for that session, and broadcasts updates from other clients to this client using the Server-Sent Events protocol.

Implementation Details
----------------------

The application uses the following technologies:

* Express.js for handling HTTP requests and serving static files
* Body-parser for parsing JSON request bodies
* CORS for enabling Cross-Origin Resource Sharing
* Keyv with Jetpack store for storing session data in a local directory
* Server-Sent Events for real-time updates

Limitations and Future Work
---------------------------

This is a simple example application, and there are many ways it could be improved or extended. Some possible areas of improvement include:

* Adding authentication and authorization to the API endpoints
* Implementing a WebSocket-based protocol for real-time updates instead of Server-Sent Events
* Adding support for more complex data models and collaboration scenarios

License
-------

This application is released under the MIT License. See the `LICENSE` file for details.