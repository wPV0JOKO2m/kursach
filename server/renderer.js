const SERVER_URL = "http://localhost:3000";
const socket = io(SERVER_URL);
let users = {};
let selectedUserId = null;

socket.on('user-registered', (data) => {
  const { id, username, displays } = data;
  if (!users[id]) {
    users[id] = { username, displays, preview: null };
    addUserToList(id, username, displays);
  } else {
    users[id].displays = displays;
    updateUserDisplays(id, displays);
  }
});

socket.on('user-disconnected', (data) => {
  removeUserFromList(data.id);
  delete users[data.id];
});

socket.on('preview-stream', (data) => {
  const { id, image } = data;
  if (users[id]) {
    users[id].preview = image;
    updateUserPreview(id, image);
  }
});

socket.on('full-stream', (data) => {
  const { id, image } = data;
  if (selectedUserId === id) {
    const streamEl = document.getElementById('stream');
    streamEl.src = "data:image/png;base64," + image;
    document.getElementById('loading').style.display = 'none';
  }
});

function addUserToList(id, username, displays) {
  const userPanel = document.getElementById('user-panel');
  const userItem = document.createElement('div');
  userItem.className = 'user-item';
  userItem.id = 'user-' + id;

  const nameEl = document.createElement('div');
  nameEl.className = 'user-name';
  nameEl.textContent = username;
  userItem.appendChild(nameEl);

  const previewImg = document.createElement('img');
  previewImg.className = 'user-preview';
  previewImg.src = '';
  userItem.appendChild(previewImg);

  if (displays && displays.length > 1) {
    const selector = document.createElement('select');
    selector.className = 'monitor-selector';
    displays.forEach((display, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = 'Monitor ' + (index + 1);
      selector.appendChild(option);
    });
    userItem.appendChild(selector);
  }

  // Создаем кнопку Full Screen
  const fullScreenButton = document.createElement('button');
  fullScreenButton.className = 'full-screen-button';
  fullScreenButton.textContent = 'Full Screen';
  fullScreenButton.addEventListener('click', () => {
    selectedUserId = id;
    let monitor = null;
    const selector = userItem.querySelector('.monitor-selector');
    if (selector) {
      monitor = selector.value;
    }
    socket.emit('request-fullscreen', { id, monitor });
    document.getElementById('stream-container').classList.add('active');
    document.getElementById('stream').style.display = 'block';

    // Добавляем кнопку Disconnect под кнопкой Full Screen, если её ещё нет
    if (!userItem.querySelector('.disconnect-button')) {
      const disconnectButton = document.createElement('button');
      disconnectButton.className = 'disconnect-button';
      disconnectButton.textContent = 'Disconnect';
      // Добавляем кнопку сразу после кнопки Full Screen
      fullScreenButton.parentElement.appendChild(disconnectButton);

      disconnectButton.addEventListener('click', () => {
        // Отправляем событие отключения через socket.io
        socket.emit('disconnectUser', { id });
        // Если этот пользователь был выбран для просмотра, очищаем область потока
        if (selectedUserId === id) {
          document.getElementById('stream').src = "";
          selectedUserId = null;
          document.getElementById('stream-container').classList.remove('active');
          document.getElementById('stream').style.display = 'none';
        }
        // Удаляем кнопку Disconnect
        disconnectButton.remove();
      });
    }
  });
  userItem.appendChild(fullScreenButton);
  userPanel.appendChild(userItem);
}

function removeUserFromList(id) {
  const userItem = document.getElementById('user-' + id);
  if (userItem) {
    userItem.remove();
  }
  if (selectedUserId === id) {
    document.getElementById('stream').src = "";
    selectedUserId = null;
  }
}

function updateUserPreview(id, image) {
  const userItem = document.getElementById('user-' + id);
  if (userItem) {
    const previewImg = userItem.querySelector('.user-preview');
    previewImg.src = "data:image/png;base64," + image;
  }
}

function updateUserDisplays(id, displays) {
  const userItem = document.getElementById('user-' + id);
  if (userItem) {
    let selector = userItem.querySelector('.monitor-selector');
    if (!selector && displays && displays.length > 1) {
      selector = document.createElement('select');
      selector.className = 'monitor-selector';
      userItem.insertBefore(selector, userItem.querySelector('.full-screen-button'));
    }
    if (selector) {
      selector.innerHTML = '';
      displays.forEach((display, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = 'Monitor ' + (index + 1);
        selector.appendChild(option);
      });
    }
  }
}
