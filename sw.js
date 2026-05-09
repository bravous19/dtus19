importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: 'AIzaSyD3h2KkvK3-bFIETWoGFV5MwzKCF3bp6KM',
authDomain: 'private-chat-app-d0af5.firebaseapp.com',
projectId: 'private-chat-app-d0af5',
messagingSenderId: '1070638135082',
appId: '1:1070638135082:web:a91683af4224c13d9f5053'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(
    payload.notification?.title || "New Message",
    {
      body: payload.notification?.body || "You received a message",
      icon: "./icon.png"
    }
  );
});
