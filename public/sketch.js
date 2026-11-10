// Ogni client disegna SOLO la sua cella della griglia in cui è suddiviso il contenuto.
// Griglia: si scelgono colonne×righe con colonne*righe = numero di client,
// in modo che ogni cella sia il più possibile vicina a un quadrato.

let ws;
let state = null;        // {index, total, media, startTime}
let offset = 0;          // differenza orologio server - client
let media = null;        // {type:'image'|'video', src, w, h}
let loadedUrl = null;
let fallback;            // immagine di prova generata con p5
let needsTap = false;    // il browser ha bloccato l'avvio automatico del video
let lastVideoCheck = 0;

// Opzioni (tasti): i = info, g = griglia, f = adatta/riempi
let showInfo = true;
let showGrid = false;
let stretch = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  fallback = makeFallback();
  connect();
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

// ---------- WebSocket ----------
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => { sync(); setInterval(sync, 5000); };
  ws.onclose = () => { state = null; };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'state') {
      state = msg;
      loadMedia(msg.media);
    } else if (msg.type === 'sync') {
      const t1 = Date.now();
      offset = msg.serverTime - (msg.t0 + t1) / 2; // compensa la latenza
    }
  };
}

function sync() {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'sync', t0: Date.now() }));
}

// ---------- Caricamento contenuto ----------
function loadMedia(m) {
  const key = m ? m.url : null;
  if (key === loadedUrl) return;
  loadedUrl = key;
  media = null;
  if (!m) return; // nessun file: si usa l'immagine di prova

  if (m.type === 'image') {
    loadImage(m.url, (img) => {
      if (loadedUrl === key) media = { type: 'image', src: img, w: img.width, h: img.height };
    });
  } else {
    const v = createVideo(m.url);
    v.hide();
    v.elt.muted = true;            // necessario per l'autoplay
    v.elt.loop = true;
    v.elt.playsInline = true;
    v.elt.addEventListener('loadedmetadata', () => {
      if (loadedUrl !== key) return;
      media = { type: 'video', src: v, w: v.elt.videoWidth, h: v.elt.videoHeight };
      v.elt.play().catch(() => { needsTap = true; });
    });
  }
}

// Mantiene i video allineati all'orologio del server
function syncVideo() {
  if (!media || media.type !== 'video' || !state) return;
  if (millis() - lastVideoCheck < 500) return;
  lastVideoCheck = millis();

  const v = media.src.elt;
  const dur = v.duration;
  if (!isFinite(dur) || dur <= 0) return;
  if (v.paused && !needsTap) v.play().catch(() => { needsTap = true; });

  const target = ((Date.now() + offset - state.startTime) / 1000) % dur;
  const diff = Math.abs(v.currentTime - target);
  if (Math.min(diff, dur - diff) > 0.3) v.currentTime = target;
}

// Un tocco/clic avvia il video se il browser l'aveva bloccato
function mousePressed() {
  if (needsTap && media && media.type === 'video') {
    media.src.elt.play().then(() => { needsTap = false; }).catch(() => {});
  }
}

// ---------- Griglia ----------
// Sceglie (colonne, righe) con colonne*righe = total, celle il più possibile quadrate
function gridFor(total, srcAspect) {
  let best = { cols: total, rows: 1 }, bestScore = Infinity;
  for (let rows = 1; rows <= total; rows++) {
    if (total % rows !== 0) continue;
    const cols = total / rows;
    const cellAspect = (srcAspect * rows) / cols;     // larghezza/altezza di una cella
    const score = Math.abs(Math.log(cellAspect));     // 0 = cella quadrata
    if (score < bestScore) { bestScore = score; best = { cols, rows }; }
  }
  return best;
}

// ---------- Disegno ----------
function draw() {
  background(0);
  if (!state) {
    fill(255); textAlign(CENTER, CENTER); textSize(20);
    text('Connessione…', width / 2, height / 2);
    return;
  }

  syncVideo();

  const src = media ? media.src : fallback;
  const srcW = media ? media.w : fallback.width;
  const srcH = media ? media.h : fallback.height;
  if (!srcW || !srcH) return;

  const { cols, rows } = gridFor(state.total, srcW / srcH);
  const i = state.index - 1;
  const col = i % cols;
  const row = Math.floor(i / cols);

  // porzione dell'originale che spetta a questo client
  const cw = srcW / cols, ch = srcH / rows;
  const sx = col * cw, sy = row * ch;

  // posizione sullo schermo: "contain" (mantiene le proporzioni) oppure "stretch"
  let dx = 0, dy = 0, dw = width, dh = height;
  if (!stretch) {
    const s = Math.min(width / cw, height / ch);
    dw = cw * s; dh = ch * s;
    dx = (width - dw) / 2; dy = (height - dh) / 2;
  }
  image(src, dx, dy, dw, dh, sx, sy, cw, ch);

  if (showGrid) {
    noFill(); stroke(255, 255, 255, 160); strokeWeight(2);
    rect(dx + 1, dy + 1, dw - 2, dh - 2);
  }

  if (showInfo) {
    noStroke(); fill(0, 0, 0, 170);
    rect(10, 10, 330, 62, 8);
    fill(255); textAlign(LEFT, TOP); textSize(14);
    text(`Sei il client ${state.index} di ${state.total}`, 20, 18);
    text(`Griglia ${cols}×${rows} · cella (${col + 1}, ${row + 1})`, 20, 38);
  }

  if (needsTap) {
    noStroke(); fill(0, 0, 0, 190); rect(0, height - 50, width, 50);
    fill(255); textAlign(CENTER, CENTER); textSize(16);
    text('Tocca lo schermo per avviare il video', width / 2, height - 25);
  }
}

function keyPressed() {
  const k = key.toLowerCase();
  if (k === 'i') showInfo = !showInfo;
  if (k === 'g') showGrid = !showGrid;
  if (k === 'f') stretch = !stretch;
}
function doubleClicked() { showInfo = !showInfo; } // per i dispositivi touch

// ---------- Immagine di prova (se public/media è vuota) ----------
function makeFallback() {
  const g = createGraphics(1600, 900);
  g.pixelDensity(1);
  g.colorMode(HSB, 360, 100, 100, 100);
  for (let x = 0; x < g.width; x++) {              // sfumatura arcobaleno
    g.stroke(map(x, 0, g.width, 0, 360), 70, 95);
    g.line(x, 0, x, g.height);
  }
  g.noStroke();
  for (let k = 1; k < 40; k++) {                   // spirale di cerchi (deterministica)
    g.fill(0, 0, 100, 35);
    g.circle(800 + Math.cos(k * 0.7) * k * 20, 450 + Math.sin(k * 0.7) * k * 11, 20 + k * 3);
  }
  g.fill(0, 0, 100);
  g.textAlign(CENTER, CENTER);
  g.textStyle(BOLD);
  g.textSize(260);
  g.text('p5.js', 800, 450);
  g.noFill(); g.stroke(0, 0, 100); g.strokeWeight(8);
  g.rect(4, 4, g.width - 8, g.height - 8);
  return g;
}
