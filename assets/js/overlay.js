// assets/js/overlay.js

let closeOnce = null;

(function () {
  let overlayEl = null;
  let state = { images: [], index: 0, onClose: null };

  function ensureOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement("div");
    overlayEl.className = "overlay";
    overlayEl.innerHTML = `
    <div class="overlay__backdrop" data-close="1">
      <div class="overlay__panel" role="dialog" aria-modal="true" aria-label="Details">
        <button class="overlay__close" type="button" aria-label="Schliessen" data-close="1">×</button>
        <div class="overlay__content"></div>
      </div>
    </div>
    `;
    document.body.appendChild(overlayEl);

    overlayEl.addEventListener("click", (e) => {
      if (e.target?.dataset?.close) close();
    });

    document.addEventListener("keydown", (e) => {
      if (!isOpen()) return;function attachSwipe(frameEl, { onPrev, onNext }) {
  let startX = 0, startY = 0, dx = 0, dy = 0, tracking = false;

  const THRESHOLD_X = 45;
  const THRESHOLD_Y = 35;

  frameEl.addEventListener("touchstart", (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    tracking = true;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    dx = dy = 0;
  }, { passive: true });

  frameEl.addEventListener("touchmove", (e) => {
    if (!tracking || !e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    dx = t.clientX - startX;
    dy = t.clientY - startY;
  }, { passive: true });

  frameEl.addEventListener("touchend", () => {
    if (!tracking) return;
    tracking = false;

    if (Math.abs(dx) > THRESHOLD_X && Math.abs(dy) < THRESHOLD_Y) {
      dx > 0 ? onPrev() : onNext();
    }
  }, { passive: true });
}

      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    });
  }

  function isOpen() {
    return overlayEl && overlayEl.classList.contains("is-open");
  }

function attachSwipe(frameEl, { onPrev, onNext }) {
  let startX = 0, startY = 0, dx = 0, dy = 0, tracking = false;

  const THRESHOLD_X = 45;
  const THRESHOLD_Y = 35;

  frameEl.addEventListener("touchstart", (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    tracking = true;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    dx = dy = 0;
  }, { passive: true });

  frameEl.addEventListener("touchmove", (e) => {
    if (!tracking || !e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    dx = t.clientX - startX;
    dy = t.clientY - startY;
  }, { passive: true });

  frameEl.addEventListener("touchend", () => {
    if (!tracking) return;
    tracking = false;

    if (Math.abs(dx) > THRESHOLD_X && Math.abs(dy) < THRESHOLD_Y) {
      dx > 0 ? onPrev() : onNext();
    }
  }, { passive: true });
}

  function open({ title, metaHtml = "", bodyHtml = "", images = [], slug = "", onClose = null }) {
    ensureOverlay();

    state.images = images || [];
    state.index = 0;
    state.onClose = onClose;

    const content = overlayEl.querySelector(".overlay__content");

    const hasImages = state.images.length > 0;

    content.innerHTML = `
      <div class="overlay__header">
        <h2>${Utils.escapeHtml(title)}</h2>
        ${metaHtml}
      </div>

      ${bodyHtml ? `<div class="overlay__text">${bodyHtml}</div>` : ""}

      ${hasImages ? `
      <div class="overlay__gallery">
        <div class="overlay__frame">
          <img class="overlay__img" alt="">
        </div>

        <div class="overlay__controls" aria-label="Bildnavigation">
          <button class="overlay__nav overlay__nav--prev" type="button" aria-label="Vorheriges Bild">‹</button>
          <div class="overlay__dots" aria-label="Bildauswahl"></div>
          <button class="overlay__nav overlay__nav--next" type="button" aria-label="Nächstes Bild">›</button>
        </div>
      </div>
      ` : ""}
    `;

    if (hasImages) {
      content.querySelector(".overlay__nav--prev").addEventListener("click", prev);
      content.querySelector(".overlay__nav--next").addEventListener("click", next);

      const frame = content.querySelector(".overlay__frame");
      if (frame && !frame.dataset.swipe) {
        attachSwipe(frame, { onPrev: prev, onNext: next });
        frame.dataset.swipe = "1";
      }

      renderImage();
      renderDots();
    }

    overlayEl.classList.add("is-open");
    document.documentElement.classList.add("no-scroll");

    const lightbox = document.querySelector(".overlay__lightbox");
    const lbImg = lightbox.querySelector("img");

    if (hasImages) {
      const imgEl = content.querySelector(".overlay__img");
      imgEl.style.cursor = "zoom-in";

      imgEl.addEventListener("click", () => {
      lbImg.src = state.images[state.index];
      lbImg.alt = `Vollansicht ${state.index + 1}`;
      lightbox.classList.add("is-open");
      });
    }    

    // Deep link: ?open=slug
    if (slug) {
      const url = new URL(window.location.href);
      url.searchParams.set("open", slug);
      url.hash = "";
      history.replaceState(null, "", url.toString());
    }
  }

  function close() {
    if (!overlayEl) return;

    overlayEl.classList.remove("is-open");
    document.documentElement.classList.remove("no-scroll");

    // remove ?open
    const url = new URL(window.location.href);
    if (url.searchParams.has("open")) {
      url.searchParams.delete("open");
      history.replaceState(null, "", url.toString());
    }

    const cb = state.onClose;
    state = { images: [], index: 0, onClose: null };
    if (typeof cb === "function") cb();

    if (closeOnce) { closeOnce(); closeOnce = null; }
  }

  function onCloseOnce(fn) {
    closeOnce = fn;
  }

  function renderImage() {
    const img = overlayEl.querySelector(".overlay__img");
    const frame = overlayEl.querySelector(".overlay__frame");
    const src = state.images[state.index];

    // Reset Klasse, bevor neues Bild lädt
    frame.classList.remove("is-portrait");

    img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight; // >1 = landscape
        if (ratio < 0.95) { // Portrait (Schwellwert kannst du anpassen)
        frame.classList.add("is-portrait");
        }
    };

    img.src = src;
    img.alt = `Bild ${state.index + 1} von ${state.images.length}`;
  }

  function renderDots() {
    const dots = overlayEl.querySelector(".overlay__dots");
    dots.innerHTML = state.images.map((_, i) => `
      <button type="button" class="overlay__dot ${i === state.index ? "is-active" : ""}"
        aria-label="Bild ${i + 1}" data-i="${i}"></button>
    `).join("");

    dots.querySelectorAll(".overlay__dot").forEach(btn => {
      btn.addEventListener("click", () => {
        state.index = Number(btn.dataset.i);
        renderImage();
        renderDots();
      });
    });
  }

  function prev() {
    if (!state.images.length) return;
    state.index = (state.index - 1 + state.images.length) % state.images.length;
    renderImage();
    renderDots();
  }

  function next() {
    if (!state.images.length) return;
    state.index = (state.index + 1) % state.images.length;
    renderImage();
    renderDots();
  }

  // public API
  window.Overlay = { open, close };

  return { open, close, onCloseOnce };
})();

// Lightbox (Vollansicht)
const lb = document.createElement("div");
lb.className = "overlay__lightbox";
lb.innerHTML = `<img alt=""><span data-close="1" style="position:absolute;inset:0"></span>`;
document.body.appendChild(lb);

lb.addEventListener("click", () => {
  lb.classList.remove("is-open");
});



