const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1350538405611831297/7kCExgLyhUB8bU03qk8YgkYfJkNuuPHcOGLA27ZL6YR9qrZswd0SqGfhUNo6t48WO8KF';

let players = {};

// Function to send Discord notifications
const sendDiscordNotification = (message) => {
  axios.post(DISCORD_WEBHOOK_URL, { content: message }).catch((err) => {
    console.error('Error sending webhook:', err);
  });
};

// Handle player connection
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // When a player joins, send them a respawn event
  socket.emit('respawn', { message: 'You have respawned!', x: 0, y: 0 });

  // Handle player shooting
  socket.on('shoot', () => {
    console.log(`Player ${socket.id} shot`);
    // Here you would handle damage calculation and event firing
    io.emit('shootEvent', { shooter: socket.id });
  });

  // Handle player reload
  socket.on('reload', () => {
    console.log(`Player ${socket.id} reloaded`);
    io.emit('reloadEvent', { player: socket.id });
  });

  // Handle player kill event
  socket.on('kill', (victimId) => {
    console.log(`Player ${socket.id} killed ${victimId}`);
    io.to(victimId).emit('death', { message: 'You died!' });
    sendDiscordNotification(`Player ${socket.id} killed ${victimId}`);
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
  });
});

// Setup the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
