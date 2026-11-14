/* SBB Light — turn an imported ticket file into images that can be shown offline.
 *
 * PDF:   every page is rendered with pdf.js (vendor/pdfjs, Apache-2.0) to a PNG.
 * QR:    jsQR (vendor/jsqr, Apache-2.0) only *locates* the code; the enlarged
 *        view is a crop of the original rendered pixels. The code is never
 *        decoded into data we keep, and never redrawn (see docs/KONZEPT.md 5.2).
 * Image: kept as is; a QR crop is added when one is found.
 *
 * Both libraries are loaded lazily, only when a ticket is imported, and are
 * precached by the service worker so importing also works offline.
 */
'use strict';

(function () {
  const PDFJS_URL = new URL('vendor/pdfjs/pdf.min.js', document.baseURI).href;
  const PDFJS_WORKER_URL = new URL('vendor/pdfjs/pdf.worker.min.js', document.baseURI).href;
  const JSQR_URL = new URL('vendor/jsqr/jsQR.js', document.baseURI).href;

  const RENDER_SCALE = 3;     // 72 dpi * 3 = 216 dpi; QR modules stay several px wide
  const PAGE_WIDTH = 1240;    // stored width of the whole-page image
  const MAX_PAGES = 4;        // SBB tickets are one page; be generous but bounded
  const QR_MARGIN = 0.12;     // quiet zone around the crop, relative to code size

  let pdfjsPromise = null;
  function loadPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import(PDFJS_URL).then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return lib;
      });
      pdfjsPromise.catch(() => { pdfjsPromise = null; });
    }
    return pdfjsPromise;
  }

  let jsqrPromise = null;
  function loadJsqr() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (!jsqrPromise) {
      jsqrPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = JSQR_URL;
        s.onload = () => (window.jsQR ? resolve(window.jsQR) : reject(new Error('jsQR fehlt')));
        s.onerror = () => { jsqrPromise = null; reject(new Error('jsQR nicht ladbar')); };
        document.head.append(s);
      });
    }
    return jsqrPromise;
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function scaled(src, width) {
    if (src.width <= width) return src;
    const c = canvas(width, (src.height * width) / src.width);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  /* Find a QR code on a canvas. Detection runs on a smaller copy first (fast),
   * then on the full canvas. Returns the crop rectangle in full-canvas pixels. */
  async function locateQr(src) {
    let jsQR;
    try { jsQR = await loadJsqr(); } catch (_) { return null; }
    const tries = [];
    if (src.width > 1000) tries.push(1000 / src.width);
    tries.push(1);
    for (const f of tries) {
      const c = f === 1 ? src : scaled(src, Math.round(src.width * f));
      const data = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
      const hit = jsQR(data.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
      if (!hit) continue;
      const loc = hit.location;
      const pts = [loc.topLeftCorner, loc.topRightCorner, loc.bottomLeftCorner, loc.bottomRightCorner];
      const xs = pts.map((p) => p.x / f), ys = pts.map((p) => p.y / f);
      let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const side = Math.max(x1 - x0, y1 - y0);
      const m = side * QR_MARGIN;
      // square crop centred on the code
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = side / 2 + m;
      x0 = Math.max(0, Math.floor(cx - half)); y0 = Math.max(0, Math.floor(cy - half));
      x1 = Math.min(src.width, Math.ceil(cx + half)); y1 = Math.min(src.height, Math.ceil(cy + half));
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    return null;
  }

  function crop(src, r) {
    const c = canvas(r.w, r.h);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    return c.toDataURL('image/png');
  }

  async function fromPdf(buffer, onProgress) {
    const pdfjs = await loadPdfjs();
    // pdf.js detaches the buffer it is given; keep the caller's copy intact.
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer.slice(0)),
      isEvalSupported: false,
      enableXfa: false,
    }).promise;
    try {
      const pageCount = doc.numPages;
      const pages = [];
      let qr = null;
      for (let i = 1; i <= Math.min(pageCount, MAX_PAGES); i++) {
        if (onProgress) onProgress(`Seite ${i} von ${pageCount}`);
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: RENDER_SCALE });
        const c = canvas(vp.width, vp.height);
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp, background: '#ffffff' }).promise;
        pages.push(scaled(c, PAGE_WIDTH).toDataURL('image/png'));
        if (!qr) {
          if (onProgress) onProgress('QR-Code suchen');
          const r = await locateQr(c);
          if (r) qr = crop(c, r);
        }
        page.cleanup();
        c.width = c.height = 0; // free memory early (iOS canvas limits)
      }
      return { pages, qr, pageCount };
    } finally {
      doc.destroy();
    }
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Bild nicht lesbar'));
      img.src = dataUrl;
    });
  }

  async function fromImage(dataUrl) {
    const img = await loadImage(dataUrl);
    const c = canvas(img.naturalWidth, img.naturalHeight);
    c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
    const r = await locateQr(c);
    // A picture that is (almost) only the code needs no separate crop.
    const useful = r && (r.w * r.h) < 0.6 * c.width * c.height;
    return { qr: useful ? crop(c, r) : null };
  }

  window.TicketRender = { fromPdf, fromImage, loadPdfjs, loadJsqr };
})();
