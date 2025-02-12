const io = require('socket.io-client');
const screenshot = require('screenshot-desktop');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected to server:', socket.id);
});

socket.on('start-stream', () => {
  console.log('Start streaming');
  const streamInterval = setInterval(() => {
    screenshot({ format: 'jpg', quality: 30 })
      .then((imgBuffer) => {
        
        socket.emit('stream', imgBuffer);
      })
      .catch((err) => {
        console.error('Screenshot error:', err);
      });
  }, 40); 

  socket.on('disconnect', () => {
    clearInterval(streamInterval);
    console.log('Disconnected from server');
  });
});