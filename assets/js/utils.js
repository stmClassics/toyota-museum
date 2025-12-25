// assets/js/utils.js
// Robust scroll-to-hash mit Offset & Re-tries (ohne Module)

(function () {
  function safeDecode(s) {
    try { return decodeURIComponent(s); }
    catch { return s; }
  }

  function scrollToIdWithOffset(id, offset, behavior) {
    const el = document.getElementById(id);
    if (!el) return false;

    const y = el.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: y, behavior });
    return true;
  }

  function scrollToHash(opts = {}) {
    const {
      prefix = "",        // z.B. "insight-" oder "car-"
      offset = 80,        // Höhe fixed header
      behavior = "smooth",
      retries = [0, 250, 800], // gegen Layout-Shift
      alsoSupportOpenParam = true, // ?open=slug
    } = opts;

    // 1) Hash bevorzugen
    let id = "";
    if (window.location.hash && window.location.hash.length > 1) {
      id = safeDecode(window.location.hash.slice(1));
    }

    // 2) Optional: ?open=slug -> id = prefix + slug
    if (!id && alsoSupportOpenParam && prefix) {
      const open = new URLSearchParams(window.location.search).get("open");
      if (open) id = prefix + safeDecode(open);
    }

    if (!id) return false;
    if (prefix && !id.startsWith(prefix)) return false;

    // Mehrfach versuchen (Render/Fonts/Images)
    let ok = false;
    retries.forEach((ms) => {
      setTimeout(() => {
        ok = scrollToIdWithOffset(id, offset, behavior) || ok;
      }, ms);
    });

    return ok;
  }

  window.ScrollUtils = { scrollToHash, scrollToIdWithOffset };
})();


// assets/js/utils.js
(function () {
  function slugify(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[m]);
  }

  window.Utils = { slugify, escapeHtml };
})();
