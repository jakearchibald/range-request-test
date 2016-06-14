self.skipWaiting();

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handling the video requests
  if (!url.pathname.endsWith('.mp4')) return;

  const swType = url.searchParams.get('sw') || 'no-intercept';
  console.log("SW Type", swType);

  switch (swType) {
    case 'no-intercept':
      return;
    case 'respond-fetch':
      event.respondWith(fetch(event.request));
      return;
    case 'respond-cache':
      event.respondWith(caches.match(event.request));
      return;
    case 'respond-manual':
      // TODO
      return;
  }
});