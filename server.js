const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MEDIA_DIR = path.join(PUBLIC_DIR, 'media');
const START_TIME = Date.now(); // riferimento temporale comune (utile per sincronizzare i video)

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const VIDEO_EXT = ['.mp4', '.webm', '.ogv', '.mov'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg', '.mov': 'video/quicktime',
  '.ico': 'image/x-icon'
};

// Cerca il primo file immagine/video in public/media (ordine alfabetico)
function findMedia() {
  try {
    for (const f of fs.readdirSync(MEDIA_DIR).sort()) {
      const ext = path.extname(f).toLowerCase();
      const url = '/media/' + encodeURIComponent(f);
      if (IMAGE_EXT.includes(ext)) return { type: 'image', url };
      if (VIDEO_EXT.includes(ext)) return { type: 'video', url };
    }
  } catch (e) { /* cartella assente: il client userà l'immagine di prova */ }
  return null;
}

// --- Server HTTP statico, con supporto "Range" (necessario per i video) ---
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(PUBLIC_DIR, urlPath === '/' ? '/index.html' : urlPath);

  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Vietato'); }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); return res.end('Non trovato'); }

    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start, end;
      if (m && m[1] === '' && m[2] !== '') {            // ultimi N byte
        start = Math.max(0, stat.size - parseInt(m[2], 10));
        end = stat.size - 1;
      } else if (m) {
        start = m[1] ? parseInt(m[1], 10) : 0;
        end = m[2] ? Math.min(parseInt(m[2], 10), stat.size - 1) : stat.size - 1;
      }
      if (!m || start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        return res.end();
      }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1
      });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }

    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  });
});

// --- WebSocket ---
const wss = new WebSocketServer({ server });
const clients = []; // ordine di connessione = numero del client

function broadcastState() {
  const media = findMedia();
  clients.forEach((ws, i) => {
    ws.send(JSON.stringify({
      type: 'state',
      index: i + 1,
      total: clients.length,
      media,
      startTime: START_TIME
    }));
  });
}

wss.on('connection', (ws) => {
  clients.push(ws);
  console.log(`Client connesso. Totale: ${clients.length}`);
  broadcastState();

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'sync') {
        ws.send(JSON.stringify({ type: 'sync', t0: data.t0, serverTime: Date.now() }));
      }
    } catch (e) { /* ignora */ }
  });

  ws.on('close', () => {
    clients.splice(clients.indexOf(ws), 1);
    console.log(`Client disconnesso. Totale: ${clients.length}`);
    broadcastState();
  });
});

server.listen(PORT, () => console.log(`Apri http://localhost:${PORT}`));
