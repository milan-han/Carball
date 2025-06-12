# Car Ball - Multiplayer .io Game

A real-time multiplayer car soccer game built with Node.js, WebSockets, and HTML5 Canvas. Start playing immediately in practice mode, then invite friends to join for multiplayer action!

## 🚗 Features

- **Instant Single-Player**: Start playing immediately in practice mode
- **Seamless Multiplayer**: Invite friends with one click to join your game
- **Real-time Multiplayer**: Up to 2 players per room using WebSockets
- **Drift Physics**: Advanced car physics with handbrake drifting and boost mechanics
- **Particle Effects**: Tire marks, smoke, sparks, and flames for immersive gameplay
- **Room System**: Create and join private game rooms with shareable links
- **Responsive Design**: Retro-styled UI with CRT scan-line effects
- **Cross-Platform**: Works on desktop and mobile browsers

## 🎮 Controls

- **WASD** - Drive and steer your car
- **SPACE** - Handbrake (enables drifting)
- **ESC** - Return to menu

## 🚀 Quick Start

### Local Development

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd Carball
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Play the game**:
   - Open http://localhost:8080 in your browser
   - Click "START PRACTICE" to play immediately
   - Click "INVITE PLAYER" during gameplay to share with friends
   - When a friend joins, you'll automatically switch to multiplayer mode

## 🎯 Game Modes

### Practice Mode
- **Single-player** car soccer training
- **Instant start** - no waiting for other players
- **Ball resets** automatically when it enters goals
- **Perfect for** learning controls and practicing drifting

### Multiplayer Mode
- **2-player** competitive car soccer
- **Real-time synchronization** via WebSockets
- **Score tracking** with goal celebrations
- **Seamless transition** from practice mode

## 🔄 Game Flow

1. **Start Practice**: Click "START PRACTICE" → Play immediately with one car
2. **Invite Friend**: Click "INVITE PLAYER" → Share the generated link
3. **Auto-Transition**: When friend joins → Automatically becomes multiplayer
4. **Competitive Play**: Score goals against each other in real-time
5. **Return to Practice**: If friend leaves → Automatically returns to practice mode

### Deployment

Deploy to any Node.js hosting platform:

**Render.com / Railway.app**:
1. Connect your GitHub repository
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Deploy and share your game URL!

**Heroku**:
```bash
heroku create your-carball-game
git push heroku main
```

## 🏗️ Architecture

### Server (Node.js + WebSockets)
- **Express.js**: Serves static files from `/public`
- **WebSocket Server**: Handles real-time multiplayer communication
- **Room Management**: Creates and manages game rooms with unique IDs
- **Game State Sync**: Host-authoritative game state with client prediction

### Client (HTML5 + Canvas)
- **WebSocket Client**: Real-time communication with server
- **Game Engine**: 60fps game loop with physics simulation
- **Input System**: Keyboard input with network synchronization
- **Rendering**: 2D canvas with retro pixel art styling
- **Mode Switching**: Seamless transitions between practice and multiplayer

## 🎯 Game Mechanics

### Car Physics
- **Acceleration**: Forward/backward movement with speed limits
- **Steering**: Velocity-based turning for realistic handling
- **Drift System**: Handbrake reduces grip for controlled sliding
- **Boost Mechanic**: Release handbrake after long drift for speed boost

### Multiplayer System
- **Host Authority**: Player 1 controls game state and physics
- **Input Synchronization**: All inputs sent to server and broadcast
- **State Updates**: Game state synchronized 60 times per second
- **Reconnection**: Automatic reconnection on connection loss
- **Dynamic Scaling**: Seamlessly handles 1-2 players

## 📁 Project Structure

```
Carball/
├── server.js          # Node.js WebSocket server
├── package.json       # Dependencies and scripts
├── public/            # Static web files
│   ├── index.html     # Game HTML structure
│   ├── script.js      # Game client code
│   └── style.css      # Retro styling
└── README.md          # This file
```

## 🔧 Configuration

### Environment Variables
- `PORT`: Server port (default: 8080)

### Game Settings (in script.js)
- `CELEBRATION_MS`: Goal celebration duration
- Car physics constants (acceleration, max speed, etc.)
- Particle system parameters

## 🌐 Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Mobile browsers with WebSocket support

## 🎨 Customization

### Adding New Features
1. **Server**: Modify `server.js` for new message types
2. **Client**: Update `script.js` for new game mechanics
3. **Styling**: Edit `style.css` for visual changes

### Example: Adding Power-ups
```javascript
// Server: Add powerup state to room
room.gameState.powerups = [];

// Client: Handle powerup messages
case 'powerupSpawned':
    spawnPowerup(msg.powerup);
    break;
```

## 🐛 Troubleshooting

### Common Issues

**"Connection Error"**
- Check if server is running on correct port
- Verify WebSocket URL in browser console

**"Room is full"**
- Each room supports max 2 players
- Create a new room or wait for players to leave

**Game lag/desync**
- Check network connection
- Host player controls game physics

**Practice mode not working**
- Ensure you clicked "START PRACTICE"
- Check browser console for JavaScript errors

### Debug Mode
Add `?debug=1` to URL for console logging:
```
http://localhost:8080?debug=1&room=ABC123
```

## 📝 License

MIT License - Feel free to use this code for your own projects!

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test both practice and multiplayer functionality
5. Submit a pull request

---

**Have fun playing Car Ball! 🚗⚽**

*Start practicing immediately, then invite friends for epic multiplayer battles!*
