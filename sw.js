self.importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
self.importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCXi3QZphKo0pnyP6IIgS_dVL0rWxpTE5Y",
  authDomain: "aegis-staff-hub.firebaseapp.com",
  projectId: "aegis-staff-hub",
  storageBucket: "aegis-staff-hub.appspot.com",
  messagingSenderId: "645411821335",
  appId: "1:645411821335:web:a3317a2caec51ec55c0952",
  measurementId: "G-1M3EW6SJZL"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/icon-192.png',
    data: {
        url: payload.fcmOptions.link
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data.url || '/';
    event.waitUntil(
        self.clients.openWindow(urlToOpen)
    );
});


const CACHE_NAME = 'aegis-hub-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/index.tsx',
  'https://145955222.fs1.hubspotusercontent-eu1.net/hubfs/145955222/AMS/Logo%20FINAL%20(2).png',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Let Firebase handle its own network requests for authentication and data sync.
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('firebaseapp.com')) {
    return; // Do not cache these requests.
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // IMPORTANT: Clone the request. A request is a stream and
        // can only be consumed once. Since we are consuming this
        // once by cache and once by the browser for fetch, we need
        // to clone the response.
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response.
            // We also cache opaque responses from CDNs, which are essential for offline functionality.
            if (!response || (response.status !== 200 && response.type !== 'opaque')) {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});