// public/firebase-messaging-sw.js
// Firebase exige este nome exato para receber mensagens em background.
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyBzhRx4tCtVzxhSfSp7_A3aKBazAoIDySI",
  authDomain:        "afine-obras-deaeb.firebaseapp.com",
  projectId:         "afine-obras-deaeb",
  storageBucket:     "afine-obras-deaeb.firebasestorage.app",
  messagingSenderId: "445289736678",
  appId:             "1:445289736678:web:10fdb656ca1ae81cb6ce27",
});

const messaging = firebase.messaging();

// Recebe mensagens quando o app está fechado ou em background
messaging.onBackgroundMessage(payload => {
  const title   = payload.notification?.title || "Afine Obras";
  const options = {
    body:  payload.notification?.body || "",
    icon:  "/logo.png",
    badge: "/logo.png",
    data:  payload.data || {},
    tag:   payload.data?.tipo || "afine",
    renotify: true,
  };
  self.registration.showNotification(title, options);
});

// Ao clicar na notificação, abre/foca o app
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const link = e.notification.data?.link || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const found = list.find(c => c.url.includes(self.location.origin));
      if (found) return found.focus();
      return clients.openWindow(link);
    })
  );
});
