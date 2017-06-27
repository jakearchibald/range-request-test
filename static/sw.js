self.skipWaiting();

function createRangedResponse(request, response) {
  console.log('Attempting to create ranged response');
  return Promise.resolve().then(() => {
    if (!response) return response;

    const rangeHeader = request.headers.get('Range').trim().toLowerCase();
    // not a range request
    if (!rangeHeader) {
      console.log('Abandoning ranged response: no response given.');
      return response;
    } 

    // already a range response, or an error, or an opaque response
    // TODO: if response is 404 should this turn into 416 range not satisfiable?
    if (response.status != 200) {
      console.log('Abandoning ranged response: not status 200, is', response.status);
      return response;
    }

    return response.arrayBuffer().then(buffer => {
      if (!rangeHeader.startsWith('bytes=')) return new Response("Invalid range unit", {status: 400});
      let start, end;

      const rangeParts = /(\d*)-(\d*)/.exec(rangeHeader);

      if (!rangeParts[1] && !rangeParts[2]) return new Response("Invalid range header", {status: 400});

      if (rangeParts[1] === '') {
        start = buffer.byteLength - Number(rangeParts[2]);
        end = buffer.byteLength;
      }
      else if (rangeParts[2] === '') {
        start = Number(rangeParts[1]);
        end = buffer.byteLength;
      }
      else {
        start = Number(rangeParts[1]);
        end = Number(rangeParts[2]) + 1; // range values are inclusive
      }

      if (end > buffer.byteLength || start < 0) return new Response("Range Not Satisfiable", {status: 416});

      const slicedBuffer = buffer.slice(start, end);
      const slicedResponse = new Response(slicedBuffer, {
        status: 206,
        headers: response.headers
      });

      console.log(`Created synthetic ranged response from ${start}-${end}`);

      slicedResponse.headers.set('Content-Length', slicedBuffer.byteLength);
      slicedResponse.headers.set('Content-Range', `bytes ${start}-${end - 1}/${buffer.byteLength}`);
      return slicedResponse;
    });
  });
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handling the audio requests
  if (!url.pathname.endsWith('.wav')) return;

  const swType = url.searchParams.get('sw') || 'no-intercept';
  const polyfilRange = url.searchParams.get('poly-range') === "1";

  console.log("SW Type", swType);

  if (swType == 'no-intercept') return;

  event.respondWith(
    Promise.resolve().then(() => {
      if (swType == 'respond-fetch') return fetch(event.request);
      if (swType == 'respond-fetch-url') return fetch(event.request.url);
      if (swType == 'respond-cache') return caches.match('/test.wav');
      return caches.match(event.request, {ignoreSearch: true});
    }).then(response => {
      if (!polyfilRange) return response;
      return createRangedResponse(event.request, response);
    }).then(response => {
      console.log(event.request, response);
      return response;
    })
  );
});
