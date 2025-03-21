
const SCREENSHOT_INTERVAL = 300;           // интервал для full-stream в мс
const PREVIEW_STREAM_INTERVAL = 5000;        // интервал для preview-stream в мс
const FULL_IMAGE_FORMAT = 'png';
const FULL_IMAGE_QUALITY = 25;
const PREVIEW_IMAGE_FORMAT = 'png';
const PREVIEW_IMAGE_QUALITY = 30;
const SERVER_URL = 'http://localhost:3000';
const DEFAULT_USERNAME = 'Anonymous';


const screenshot = require('screenshot-desktop');
const io = require('socket.io-client');
const minimist = require('minimist');

//cli args
const argv = minimist(process.argv.slice(2));
const username = argv.username || DEFAULT_USERNAME;


const socket = io(SERVER_URL);

let currentMonitor = null;

socket.on('connect', () => {
  console.log(`connected to server as ${username}`);
  socket.emit('register', { username });

  screenshot.listDisplays().then(displays => {
    socket.emit('displays', { displays });
    startStreaming();
  }).catch(err => {
    console.error('Error listing displays:', err);
    startStreaming();
  });
});


socket.on('switch-monitor', ({ monitor }) => {
  console.log('switching to monitor:', monitor);
  currentMonitor = monitor;
});

function startStreaming() {
  setInterval(() => {
    const options = currentMonitor !== null
      ? { screen: currentMonitor, format: FULL_IMAGE_FORMAT, quality: FULL_IMAGE_QUALITY }
      : { format: FULL_IMAGE_FORMAT };
    screenshot(options)
      .then(img => {
        socket.emit('full-stream', { image: img.toString('base64'), monitor: currentMonitor });
      })
      .catch(err => console.error('full-screen stream error:', err));
  }, SCREENSHOT_INTERVAL);

  setInterval(() => {
    screenshot({ format: PREVIEW_IMAGE_FORMAT, quality: PREVIEW_IMAGE_QUALITY })
      .then(img => {
        socket.emit('preview-stream', { image: img.toString('base64') });
      })
      .catch(err => console.error('preview stream error:', err));
  }, PREVIEW_STREAM_INTERVAL);
}

process.on('SIGINT', () => {
  console.log('Disconnecting...');
  socket.disconnect();
  process.exit();
});
