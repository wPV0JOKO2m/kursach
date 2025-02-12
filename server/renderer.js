window.addEventListener('DOMContentLoaded', () => {
  // получаем элемент списка пользователей
  const usersList = document.getElementById('user-panel');
  // получаем элемент изображения стрима
  const streamImg = document.getElementById('stream');
  // получаем индикатор загрузки
  const loadingIndicator = document.getElementById('loading');
  // объект для хранения подключенных пользователей
  const users = {};

  // обработчик события подключения пользователя
  window.electronAPI.onUserConnected((event, id) => {
    if (!users[id]) {
      users[id] = true;
      const li = document.createElement('li');
      li.textContent = id;
      li.dataset.id = id;
      usersList.appendChild(li);
      console.log(`User connected: ${id}`);
    }
  });

  // обработчик события отключения пользователя
  window.electronAPI.onUserDisconnected((event, id) => {
    if (users[id]) {
      delete users[id];
      // исправлено обращение к селектору
      const li = usersList.querySelector(`li[data-id="${id}"]`);
      if(li) {
        li.remove();
      }
      console.log(`User disconnected: ${id}`);
      // скрываем изображение стрима, если отключился текущий пользователь
      if(streamImg.dataset.id === id){
        streamImg.style.display = 'none';
        streamImg.src = '';
      }
    }
  });

  // обработчик двойного клика по пользователю для запроса стрима (работает сомнительно)
  usersList.addEventListener('dblclick', (e) => {
    if(e.target && e.target.nodeName === 'LI') {
      const userId = e.target.dataset.id;
      console.log(`Requesting stream from user: ${userId}`);
      window.electronAPI.requestStream(userId);
      streamImg.dataset.id = userId;
      streamImg.style.display = 'block';
      loadingIndicator.style.display = 'block';
      streamImg.src = ''; 
    }
  });

  // обработчик получения данных стрима
  window.electronAPI.onStreamData((event, { id, data }) => {
    if(streamImg.dataset.id === id){
      // создаем URL из полученных данных
      const blob = new Blob([data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      streamImg.src = url;
      // скрываем индикатор загрузки
      loadingIndicator.style.display = 'none';
 
      // освобождаем URL после загрузки изображения
      streamImg.onload = () => {
        URL.revokeObjectURL(url);
      };
    }
  });
});
