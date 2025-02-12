# ScreenStream

A minimal demo(beta) using Socket.io for sending screens, Electron for admin panel & screenshot-desktop for making screens.

**Client:**
- Connects to localhost:3000.
- On "start-stream", captures desktop screenshots every 40ms and sends result to server.

**Server:**
- Electron app with a Socket.io server.
- Displays connected users and live stream in an admin window.

**Usage:**
1. Install dependencies(for example  ```npm install screenshot-desktop socket.io-client electron socket.io```)
2. Start server part(npm start in admin/ folder)
2. Run the client script.(node client.js in client/ folder)
3. Select a user in the admin panel to view its screen.

**TODO:**
- correct disconnect handling
- handle situations where there are more than one screen(now it shows the one where the script where started)
- add preview of screen for users