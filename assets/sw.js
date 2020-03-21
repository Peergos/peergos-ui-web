/* global self ReadableStream Response */

const downloadMap = new Map()
var streamingMap

// This should be called once per download
// Each event has a dataChannel that the data will be piped through
self.onmessage = event => {
  // We send a heartbeat every x secound to keep the
  // service worker alive
  if (event.data === 'ping') {
    return
  }

  // Create a uniq link for the download
  const uniqLink = self.registration.scope + 'intercept-me-nr' + Math.random()
  const port = event.ports[0]

  var filename = event.data.filename
  var headers
  if (filename.startsWith("media")) {
      var entry = new CacheEntry(event.data.size);
      setupStreamingEntry(port, entry)
      streamingMap = new Map()
      streamingMap.set(uniqLink, [entry, port])
  } else {
      // Make filename RFC5987 compatible
      filename = encodeURIComponent(filename).replace(/['()]/g, escape)
          .replace(/\*/g, '%2A')
      headers = {
          'Content-Type': event.data.mimeType,
          'Content-Disposition': "attachment; filename*=UTF-8''" + filename
      }
      const stream = event.data.readableStream || createStream(port)
      if (event.data.size) headers['Content-Length'] = event.data.size
      downloadMap.set(uniqLink, [stream, headers])
  }

  port.postMessage({ download: uniqLink, ping: self.registration.scope + 'ping' })

  // Mistage adding this and have streamsaver.js rely on it
  // depricated as from 0.2.1
  port.postMessage({ debug: 'Mocking a download request' })
}

function CacheEntry(fileSize) {
    this.fileSize = fileSize;
    this.bytes = new Uint8Array(0);
    this.skip = false;
    this.firstRun = true;
    this.getFileSize = function() {
        return this.fileSize;
    }
    this.setSkip = function() {
        if(this.firstRun) {
            this.firstRun = false;
        } else {
            this.skip = true;
        }
    }
    this.getSkip = function() {
        return this.skip;
    }
    this.reset = function() {
        this.bytes = new Uint8Array(0);
        this.skip = false;
    }
    this.enqueue = function(moreData) {
        const currentBytes = this.bytes;
        const combinedSize = currentBytes.byteLength + moreData.byteLength;
        var newStore = new Uint8Array(combinedSize);
        newStore.set(currentBytes);
        newStore.set(moreData, currentBytes.byteLength);
        this.bytes = newStore;
    }
}

function setupStreamingEntry(port, entry) {
    port.onmessage = ({ data }) => {
        if (data != 'end' && data != 'abort') {
            if (data.byteLength == 0) {
                entry.reset()
            } else {
                entry.enqueue(data)
            }
        }
    }
}

function createStream (port) {
  // ReadableStream is only supported by chrome 52
  return new ReadableStream({
    start (controller) {
      // When we receive data on the messageChannel, we write
      port.onmessage = ({ data }) => {
        if (data === 'end') {
          return controller.close()
        }

        if (data === 'abort') {
          controller.error('Aborted the download')
          return
        }
        controller.enqueue(data)
      }
    },
    cancel () {
      console.log('user aborted')
    }
  })
}

self.addEventListener('install', event =>  {
    self.skipWaiting();
});
self.addEventListener('activate', event => {
    clients.claim();
});

const maxBlockSize = 1024 * 1024 * 5;

self.onfetch = event => {
    const url = event.request.url

    if (url.endsWith('/ping')) {
      return event.respondWith(new Response('pong', {
        headers: { 'Access-Control-Allow-Origin': '*' }
      }))
    }
    if (event.request.headers.get('range') && streamingMap != null) {
        const streamingEntry = streamingMap.get(url)
        if (!streamingEntry) return;
        const [cacheEntry, port] = streamingEntry

        const bytes = /^bytes\=(\d+)\-(\d+)?$/g.exec(
            event.request.headers.get('range')
        );
        const start = Number(bytes[1]);
        const blockSize = cacheEntry.firstRun ? 1024 * 1024 : maxBlockSize;
        var end = Math.min(Number(bytes[2]) || start + blockSize - 1, start + blockSize - 1);
        if(end > cacheEntry.fileSize - 1) {
            end = cacheEntry.fileSize - 1;
        }
        const seekHi = (start - (start % Math.pow(2, 32)))/Math.pow(2, 32);
        const seekLength = end-start + 1;
        cacheEntry.setSkip();
        port.postMessage({ seekHi: seekHi, seekLo: start, seekLength: seekLength })
        return event.respondWith(returnRangeRequest(start, end, cacheEntry))
    } else {
        const downloadEntry = downloadMap.get(url)
        if (!downloadEntry) return;

        const [stream, headers] = downloadEntry
        downloadMap.delete(url)
        return event.respondWith(new Response(stream, { headers }))
    }
}

function returnRangeRequest(start, end, cacheEntry) {
    const fileSize = cacheEntry.getFileSize();
    return new Promise(function(resolve, reject) {
        let pump = () => {
            const store = cacheEntry.bytes;
            if (cacheEntry.getSkip() || store.byteLength != end-start + 1) {
                setTimeout(pump, 500)
            } else {
                resolve(store);
            }
        }
        pump()
    }).then(function(arrayBuffer, err) {
        if (arrayBuffer == null) {
            return new Response(null, {
              status: 416,
              statusText: 'Range Not Satisfiable',
              headers: [['Content-Range', `*/${fileSize}`]]
            });
        } else {
            const bytesProvided = start +  arrayBuffer.byteLength - 1;
            return new Response(arrayBuffer, {
              status: 206,
              statusText: 'Partial Content',
              headers: [
//               'Content-Type': 'video/mp4',
                ['accept-ranges', 'bytes'],
                ['Content-Range', `bytes ${start}-${bytesProvided}/${fileSize}`],
                ['content-length', arrayBuffer.byteLength]
              ]
            });
        }
    });
}

