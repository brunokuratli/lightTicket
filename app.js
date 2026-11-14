/* SBB Light — a minimal Swiss timetable + ticket wallet.
 *
 * Timetable data: transport.opendata.ch (public, no API key, CORS enabled).
 * Tickets: original PDF (or image) plus rendered pages and a QR crop, stored
 *          locally in IndexedDB; nothing leaves the device (ticket-render.js).
 *
 * Written as a single dependency-free script so it runs offline as a PWA
 * and stays close to the Light Phone's minimalist, distraction-free spirit.
 */
'use strict';

const API = 'https://transport.opendata.ch/v1';

/* ---------------- small helpers ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  for (const c of [].concat(children)) n.append(c);
  return n;
};
const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '--:--' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtDur = (dur) => {
  // API format "00d02:15:00" -> "2h 15"
  const m = /(\d+)d(\d+):(\d+):/.exec(dur || '');
  if (!m) return '';
  const [, d, h, mi] = m.map(Number);
  const hours = d * 24 + h;
  return hours > 0 ? `${hours}h ${pad(mi)}` : `${mi} min`;
};

const API_TIMEOUT = 15000; // ms; then the last stored result is shown instead

async function api(path, params) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl && setTimeout(() => ctrl.abort(), API_TIMEOUT);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl && ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err && err.name === 'AbortError') throw new Error('Zeitüberschreitung');
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ---------------- local store: favourites and last results ----------------
 * Everything here stays in localStorage on this device.
 * Last results: one entry per route / station (newest 8 each). They are shown
 * when the network fails, clearly marked «ohne Echtzeit, Stand hh:mm», and an
 * identical request within 30 s is answered from them (transport.opendata.ch
 * asks clients to cache instead of repeating requests). */
const store = {
  get(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (_) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  },
};
const FAV_MAX = 5;
const LAST_MAX = 8;
const SAME_REQUEST_MS = 30000;
const norm = (s) => String(s || '').trim().toLowerCase();

function lastGet(kind, key) {
  return store.get('sbb.last.' + kind, []).find((e) => e.key === key) || null;
}
function lastPut(kind, key, params, data) {
  const list = store.get('sbb.last.' + kind, []).filter((e) => e.key !== key);
  list.unshift({ key, params, at: Date.now(), data });
  // drop the oldest until it fits (localStorage is a few MB)
  for (let n = Math.min(list.length, LAST_MAX); n > 0; n--) {
    if (store.set('sbb.last.' + kind, list.slice(0, n))) return;
  }
}
function staleNote(entry) {
  const d = new Date(entry.at);
  const today = new Date().toDateString() === d.toDateString();
  const when = (today ? '' : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. `) + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const why = !navigator.onLine ? 'Keine Internetverbindung' : 'Fahrplan gerade nicht erreichbar';
  return el('div', { className: 'stale' }, [
    el('strong', { textContent: `Ohne Echtzeit, Stand ${when}` }),
    el('p', { textContent: `${why}. Gezeigt wird das letzte Ergebnis dieser Suche; Verspätungen und Gleise können sich geändert haben.` }),
  ]);
}

function favList(kind) { return store.get('sbb.fav.' + kind, []); }
function favSave(kind, list) { store.set('sbb.fav.' + kind, list.slice(0, FAV_MAX)); }
function favHas(kind, key) { return favList(kind).some((f) => f.key === key); }
function favToggle(kind, fav) {
  const list = favList(kind);
  const i = list.findIndex((f) => f.key === fav.key);
  if (i >= 0) list.splice(i, 1);
  else {
    if (list.length >= FAV_MAX) { alert(`Höchstens ${FAV_MAX} Favoriten. Bitte zuerst einen entfernen.`); return false; }
    list.push(fav);
  }
  favSave(kind, list);
  return true;
}

/* ---------------- tab navigation ---------------- */
function showView(name) {
  $$('.view').forEach((v) => (v.hidden = v.dataset.view !== name));
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === name)));
  try { localStorage.setItem('sbb.view', name); } catch (_) {}
}
$$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

/* ---------------- station autocomplete ---------------- */
function attachAutocomplete(input, datalist) {
  let timer, lastQuery = '';
  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length < 2 || q === lastQuery) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      lastQuery = q;
      try {
        const data = await api('/locations', { query: q, type: 'station' });
        datalist.replaceChildren(
          ...(data.stations || [])
            .filter((s) => s.name)
            .slice(0, 7)
            .map((s) => el('option', { value: s.name }))
        );
      } catch (_) { /* offline / rate limited — silently skip suggestions */ }
    }, 250);
  });
}

/* ---------------- Fahrplan (connections) ---------------- */
const connForm = $('#conn-form');
const connResults = $('#conn-results');

$('#swap').addEventListener('click', () => {
  const a = $('#conn-from'), b = $('#conn-to');
  [a.value, b.value] = [b.value, a.value];
});

connForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const from = $('#conn-from').value.trim();
  const to = $('#conn-to').value.trim();
  if (!from || !to) return;
  const params = {
    from, to,
    date: $('#conn-date').value,
    time: $('#conn-time').value,
    isArrivalTime: $('#conn-mode').value,
    limit: 6,
  };
  const key = `${norm(from)}|${norm(to)}`;
  const last = lastGet('conn', key);
  connResults.innerHTML = '';
  connResults.append(el('p', { className: 'msg loading', textContent: 'Suche' }));
  try {
    let data;
    if (last && Date.now() - last.at < SAME_REQUEST_MS && JSON.stringify(last.params) === JSON.stringify(params)) {
      data = last.data;
    } else {
      data = await api('/connections', params);
      lastPut('conn', key, params, { connections: data.connections || [] });
    }
    renderConnections(data.connections || [], { from, to, key });
  } catch (err) {
    connResults.innerHTML = '';
    if (last) {
      renderConnections(last.data.connections || [], { from, to, key });
      connResults.prepend(staleNote(last));
    } else {
      connResults.append(errorBox(err));
    }
  }
});

function favButton(kind, fav, onChange) {
  const label = () => (favHas(kind, fav.key) ? '★ Favorit' : '☆ Als Favorit merken');
  const b = el('button', { type: 'button', className: 'fav-toggle', textContent: label() });
  b.setAttribute('aria-pressed', String(favHas(kind, fav.key)));
  b.addEventListener('click', () => {
    if (favToggle(kind, fav)) {
      b.textContent = label();
      b.setAttribute('aria-pressed', String(favHas(kind, fav.key)));
      onChange();
    }
  });
  return b;
}

function renderFavs(kind, box, onPick) {
  const list = favList(kind);
  box.replaceChildren(...list.map((f) => el('span', { className: 'fav' }, [
    el('button', { type: 'button', className: 'fav-go', textContent: f.label, onclick: () => onPick(f) }),
    el('button', {
      type: 'button', className: 'fav-del', textContent: '✕',
      title: `${f.label} entfernen`, ariaLabel: `${f.label} entfernen`,
      onclick: () => { favSave(kind, favList(kind).filter((x) => x.key !== f.key)); renderFavs(kind, box, onPick); },
    }),
  ])));
  box.hidden = !list.length;
}
const connFavs = $('#conn-favs');
const boardFavs = $('#board-favs');
function nowFields() {
  const now = new Date();
  $('#conn-date').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  $('#conn-time').value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $('#conn-mode').value = '0';
}
const showConnFavs = () => renderFavs('conn', connFavs, (f) => {
  $('#conn-from').value = f.from;
  $('#conn-to').value = f.to;
  nowFields(); // a favourite means «next connections from now»
  connForm.requestSubmit ? connForm.requestSubmit() : connForm.dispatchEvent(new Event('submit', { cancelable: true }));
});
const showBoardFavs = () => renderFavs('board', boardFavs, (f) => {
  $('#board-station').value = f.station;
  boardForm.requestSubmit ? boardForm.requestSubmit() : boardForm.dispatchEvent(new Event('submit', { cancelable: true }));
});

function renderConnections(conns, route) {
  connResults.innerHTML = '';
  if (route) {
    connResults.append(el('div', { className: 'result-head' }, [
      el('span', { className: 'msg', textContent: `${route.from} → ${route.to}` }),
      favButton('conn', { key: route.key, from: route.from, to: route.to, label: `${route.from} → ${route.to}` }, showConnFavs),
    ]));
  }
  if (!conns.length) {
    connResults.append(el('p', { className: 'msg', textContent: 'Keine Verbindungen gefunden.' }));
    return;
  }
  for (const c of conns) {
    const legs = (c.sections || [])
      .filter((s) => s.journey)
      .map((s) => el('span', { className: 'leg', textContent: `${s.journey.category || ''}${s.journey.number || ''}`.trim() || s.journey.name || '' }));
    const walkOnly = legs.length === 0;
    if (walkOnly) legs.push(el('span', { className: 'leg', textContent: 'Fussweg' }));

    const depDelay = c.from.delay ? ` +${c.from.delay}` : '';
    const card = el('div', { className: 'conn' }, [
      el('div', { className: 'conn-head' }, [
        el('div', { className: 'conn-times' }, [
          document.createTextNode(`${fmtTime(c.from.departure)}`),
          el('span', { className: 'delay', textContent: depDelay }),
          document.createTextNode(` → ${fmtTime(c.to.arrival)}`),
        ]),
        el('div', { className: 'conn-dur' }, [
          el('div', { textContent: fmtDur(c.duration) }),
          el('div', { textContent: `${c.transfers || 0} Umst.` }),
        ]),
      ]),
      el('div', { className: 'conn-sub' }, [
        el('span', { className: 'plat', textContent: c.from.platform ? `Gleis ${c.from.platform}` : '' }),
        el('span', { className: 'plat', textContent: c.to.station && c.to.station.name ? `→ ${c.to.station.name}` : '' }),
      ]),
      el('div', { className: 'conn-legs' }, legs),
    ]);
    connResults.append(card);
  }
}

/* ---------------- Abfahrten (stationboard) ---------------- */
const boardForm = $('#board-form');
const boardResults = $('#board-results');

boardForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const station = $('#board-station').value.trim();
  if (!station) return;
  const params = { station, limit: 14 };
  const key = norm(station);
  const last = lastGet('board', key);
  boardResults.innerHTML = '';
  boardResults.append(el('p', { className: 'msg loading', textContent: 'Laden' }));
  try {
    let data;
    if (last && Date.now() - last.at < SAME_REQUEST_MS) {
      data = last.data;
    } else {
      data = await api('/stationboard', params);
      lastPut('board', key, params, { station: data.station, stationboard: data.stationboard || [] });
    }
    renderBoard(data, station);
  } catch (err) {
    boardResults.innerHTML = '';
    if (last) {
      renderBoard(last.data, station);
      boardResults.prepend(staleNote(last));
    } else {
      boardResults.append(errorBox(err));
    }
  }
});

function renderBoard(data, query) {
  boardResults.innerHTML = '';
  const list = data.stationboard || [];
  if (!list.length) {
    boardResults.append(el('p', { className: 'msg', textContent: 'Keine Abfahrten gefunden.' }));
    return;
  }
  const name = (data.station && data.station.name) || query || '';
  boardResults.append(el('div', { className: 'result-head' }, [
    el('span', { className: 'msg', textContent: name }),
    favButton('board', { key: norm(query || name), station: query || name, label: name }, showBoardFavs),
  ]));
  for (const s of list) {
    const stop = s.stop || {};
    const delay = stop.delay ? el('span', { className: 'delay', textContent: ` +${stop.delay}` }) : '';
    const row = el('div', { className: 'board-row' }, [
      el('span', { className: 'board-time' }, [document.createTextNode(fmtTime(stop.departure)), delay]),
      el('span', { className: 'board-line', textContent: `${s.category || ''}${s.number || ''}`.trim() || s.name || '' }),
      el('span', { className: 'board-dest', textContent: s.to || '' }),
      el('span', { className: 'board-plat', textContent: stop.platform ? `Gl. ${stop.platform}` : '' }),
    ]);
    boardResults.append(row);
  }
}

function errorBox(err) {
  const offline = !navigator.onLine;
  return el('div', { className: 'err' }, [
    el('strong', { textContent: offline ? 'Keine Internetverbindung' : 'Fehler beim Laden' }),
    el('p', { className: 'msg', textContent: offline
      ? 'Der Fahrplan braucht Internet; zuletzt gesuchte Strecken werden ohne Netz mit Zeitstempel gezeigt. Deine Tickets funktionieren auch offline.'
      : `Bitte später erneut versuchen. (${err.message})` }),
  ]);
}

/* ================= Ticket wallet (IndexedDB) ================= */
const DB_NAME = 'sbb-light';
const STORE = 'tickets';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function dbPut(ticket) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(ticket);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    // e.g. storage quota: Safari may abort the commit without an error event
    tx.onabort = () => reject(tx.error || new Error('Speichern abgebrochen'));
  });
}
async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const ticketList = $('#ticket-list');
const dialog = $('#ticket-dialog');
const ticketForm = $('#ticket-form');
const preview = $('#t-preview');
const statusEl = $('#t-status');
const saveBtn = $('#t-save');

/* What the selected file turned into; filled by the change handler. */
let pending = null;   // { kind, image?, pdf?, fileName, pages?, qr?, pageCount? }
let pendingJob = 0;   // guards against a slow import finishing after a newer one

function newId() {
  return 't-' + Date.now().toString(36) + '-' + Math.floor(performance.now() * 1000).toString(36);
}

function setStatus(text) {
  statusEl.textContent = text || '';
  statusEl.hidden = !text;
}

function readFile(file, as) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('Datei nicht lesbar'));
    if (as === 'buffer') r.readAsArrayBuffer(file); else r.readAsDataURL(file);
  });
}

function isPdf(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

function titleFromFile(name) {
  return (name || '').replace(/\.(pdf|png|jpe?g|heic|webp|gif)$/i, '').replace(/[_]+/g, ' ').trim();
}

$('#add-ticket').addEventListener('click', () => {
  ticketForm.reset();
  pending = null;
  pendingJob++;
  setStatus('');
  saveBtn.disabled = false;
  preview.hidden = true;
  preview.removeAttribute('src');
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
});
$('#t-cancel').addEventListener('click', () => { pendingJob++; dialog.close(); });

$('#t-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  const job = ++pendingJob;
  pending = null;
  preview.hidden = true;
  if (!file) { setStatus(''); return; }
  if (!$('#t-title').value.trim()) $('#t-title').value = titleFromFile(file.name);
  saveBtn.disabled = true;
  try {
    if (isPdf(file)) {
      setStatus('PDF wird gelesen …');
      const pdf = await readFile(file, 'buffer');
      const out = await TicketRender.fromPdf(pdf, (s) => job === pendingJob && setStatus(`PDF wird gelesen … ${s}`));
      if (job !== pendingJob) return;
      if (!out.pages.length) throw new Error('PDF ohne Seiten');
      pending = { kind: 'pdf', pdf, fileName: file.name, ...out };
      preview.src = out.qr || out.pages[0];
      const n = out.pages.length;
      const pagesText = `${n} ${n === 1 ? 'Seite' : 'Seiten'}` + (out.pageCount > n ? ` von ${out.pageCount}` : '');
      setStatus(out.qr
        ? `PDF gelesen (${pagesText}), QR-Code gefunden.`
        : `PDF gelesen (${pagesText}). Kein QR-Code erkannt: beim Vorzeigen wird die ganze Seite gezeigt.`);
    } else {
      setStatus('Bild wird gelesen …');
      const image = await readFile(file, 'dataurl');
      const out = await TicketRender.fromImage(image).catch(() => ({ qr: null }));
      if (job !== pendingJob) return;
      pending = { kind: 'image', image, fileName: file.name, qr: out.qr };
      preview.src = image;
      setStatus(out.qr ? 'Bild gelesen, QR-Code gefunden.' : 'Bild gelesen.');
    }
    preview.hidden = false;
  } catch (err) {
    if (job !== pendingJob) return;
    pending = null;
    setStatus(`Datei konnte nicht gelesen werden (${err.message || err}). Bitte das Original-PDF oder ein Bild wählen.`);
  } finally {
    if (job === pendingJob) saveBtn.disabled = false;
  }
});

ticketForm.addEventListener('submit', async (e) => {
  // method="dialog" closes the dialog; persist first.
  if (!pending) {
    e.preventDefault();
    alert('Bitte das Billett als PDF oder Bild hinzufügen.');
    return;
  }
  const ticket = {
    id: newId(),
    title: $('#t-title').value.trim() || 'Ticket',
    fromDate: $('#t-from-date').value,
    toDate: $('#t-to-date').value,
    note: $('#t-note').value.trim(),
    created: new Date().toISOString(),
    ...pending,
  };
  pending = null;
  try {
    await dbPut(ticket);
  } catch (err) {
    alert(`Ticket konnte nicht gespeichert werden (${(err && err.message) || err}). Ist der Speicher des Geräts voll?`);
  }
  renderTickets();
});

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d ? `${d}.${m}.${y}` : iso;
}

function todayIso() {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

function thumbOf(t) {
  return t.qr || (t.pages && t.pages[0]) || t.image || '';
}

async function renderTickets() {
  const items = (await dbAll()).sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  ticketList.innerHTML = '';
  if (!items.length) {
    ticketList.append(el('p', { className: 'msg', textContent: 'Noch keine Tickets gespeichert.' }));
    return;
  }
  const today = todayIso();
  for (const t of items) {
    const dates = [fmtDate(t.fromDate), fmtDate(t.toDate)].filter(Boolean).join(' – ');
    const expired = t.toDate && t.toDate < today;
    const tags = [t.kind === 'pdf' ? 'PDF' : 'Bild', expired ? 'abgelaufen' : ''].filter(Boolean).join(' · ');
    const card = el('div', { className: 'ticket' + (expired ? ' expired' : '') }, [
      el('img', { className: 'ticket-thumb', src: thumbOf(t), alt: '' }),
      el('div', { className: 'ticket-info' }, [
        el('div', { className: 'ticket-title', textContent: t.title }),
        dates ? el('div', { className: 'ticket-dates', textContent: dates }) : '',
        el('div', { className: 'ticket-tags', textContent: tags }),
        t.note ? el('div', { className: 'ticket-note', textContent: t.note }) : '',
      ]),
      el('div', { className: 'ticket-actions' }, [
        el('button', { className: 'show', textContent: 'Zeigen', onclick: () => openViewer(t) }),
        el('button', { textContent: 'Löschen', onclick: async () => {
          if (confirm(`Ticket «${t.title}» löschen?`)) { await dbDelete(t.id); renderTickets(); }
        } }),
      ]),
    ]);
    ticketList.append(card);
  }
}

/* ---------------- Fullscreen ticket viewer ---------------- */
const viewer = $('#ticket-viewer');
const viewerImage = $('#viewer-image');
const viewerPages = $('#viewer-pages');
const viewerModes = $('#viewer-modes');
let viewerTicket = null;
let pdfUrl = '';

function setViewerMode(mode) {
  const t = viewerTicket;
  if (!t) return;
  const pages = t.pages && t.pages.length ? t.pages : (t.image ? [t.image] : []);
  const showQr = mode === 'qr' && t.qr;
  $('#mode-qr').setAttribute('aria-selected', String(!!showQr));
  $('#mode-page').setAttribute('aria-selected', String(!showQr));
  viewer.classList.toggle('page-mode', !showQr);
  if (showQr) {
    viewerImage.src = t.qr;
    viewerImage.hidden = false;
    viewerPages.hidden = true;
  } else {
    viewerImage.hidden = true;
    viewerImage.removeAttribute('src');
    viewerPages.replaceChildren(...pages.map((src, i) =>
      el('img', { src, alt: `Billett, Seite ${i + 1}`, className: 'viewer-page' })));
    viewerPages.hidden = false;
  }
}
$('#mode-qr').addEventListener('click', () => setViewerMode('qr'));
$('#mode-page').addEventListener('click', () => setViewerMode('page'));

function openViewer(t) {
  viewerTicket = t;
  $('#viewer-title').textContent = t.title;
  const dates = [fmtDate(t.fromDate), fmtDate(t.toDate)].filter(Boolean).join(' – ');
  $('#viewer-meta').textContent = [dates, t.note].filter(Boolean).join(' · ');
  viewerModes.hidden = !t.qr;
  const hint = $('#viewer-hint');
  hint.replaceChildren();
  // A home-screen app on iOS opens target=_blank links outside the app, where
  // the blob URL does not exist; there «Ganze Seite» covers the same need.
  const standalone = navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (t.kind === 'pdf' && !standalone) {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl = URL.createObjectURL(new Blob([t.pdf], { type: 'application/pdf' }));
    hint.append(
      document.createTextNode('Bildschirm hell stellen. Ausweis bereithalten. '),
      el('a', { href: pdfUrl, target: '_blank', rel: 'noopener', textContent: 'Original-PDF öffnen' }));
  } else {
    hint.textContent = 'Bildschirm hell stellen. Ausweis bereithalten.';
  }
  setViewerMode(t.qr ? 'qr' : 'page');
  viewer.hidden = false;
  viewer.scrollTop = 0;
  // Try to keep the screen awake so the code stays visible for scanning.
  requestWakeLock();
}
function closeViewer() {
  viewer.hidden = true;
  viewerTicket = null;
  viewerPages.replaceChildren();
  releaseWakeLock();
}
$('#viewer-close').addEventListener('click', closeViewer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !viewer.hidden) closeViewer(); });

/* Screen wake lock (best effort; ignored where unsupported) */
let wakeLock = null;
async function requestWakeLock() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
}
function releaseWakeLock() {
  try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (_) {}
}
// The browser drops the lock when the page is hidden; take it again on return.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !viewer.hidden) requestWakeLock();
});

/* ---------------- network status ---------------- */
const netEl = $('#net');
function updateNet() { netEl.className = 'net' + (navigator.onLine ? '' : ' offline'); }
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);

/* ---------------- init ---------------- */
function init() {
  // default date/time = now
  nowFields();
  showConnFavs();
  showBoardFavs();

  attachAutocomplete($('#conn-from'), $('#stations-from'));
  attachAutocomplete($('#conn-to'), $('#stations-to'));
  attachAutocomplete($('#board-station'), $('#stations-board'));

  let start = 'fahrplan';
  try { start = localStorage.getItem('sbb.view') || 'fahrplan'; } catch (_) {}
  showView(start);
  updateNet();
  renderTickets();
  // Ask the browser not to evict stored tickets (best effort).
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (_) {}

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}
init();
