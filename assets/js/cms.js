// Einfaches Mikro-CMS für Textdateien im Format:
// key: value
// ...
// ---
// Fliesstext

window.CMS = (function () {
  async function fetchJSON(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
    return r.json();
  }

  async function fetchText(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
    return r.text();
  }

  function parseTextFile(txt) {
    const [headRaw, ...bodyParts] = txt.split("\n---");
    const meta = {};

    headRaw.split("\n").forEach(line => {
      const i = line.indexOf(":");
      if (i > -1) {
        const key = line.slice(0, i).trim();
        const value = line.slice(i + 1).trim();
        if (key) meta[key] = value;
      }
    });

    const body = bodyParts.join("\n---").trim();
    return { meta, body };
  }

  function bodyToHTML(body) {
    // Super simpel: Absätze durch Leerzeile getrennt → <p>
    const esc = (s) => s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    return body
      .split(/\n{2,}/)
      .map(p => `<p>${esc(p).replaceAll("\n", "<br>")}</p>`)
      .join("");
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("de-CH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }

async function loadCollection(basePath) {
  // basePath z.B. "/content/news"
  const indexData = await fetchJSON(`${basePath}/index.json`);
  const imageBase = indexData.imageBase || "";
  const entries = indexData.entries;

  const items = await Promise.all(
    entries.map(async (entry) => {
      // entry ist z.B. "herbsttreffen-2025" ODER "herbsttreffen-2025.txt"
      const hasExt = entry.endsWith(".txt");
      const fileName = hasExt ? entry : `${entry}.txt`;
      const slug = hasExt ? entry.replace(/\.txt$/i, "") : entry;

      const raw = await fetchText(`${basePath}/${fileName}`);
      const { meta, body } = parseTextFile(raw);
      if (imageBase && meta.images) {
        meta.images = meta.images
          .split(",")
          .map(path => imageBase + path.trim())
          .join(",");
      }

      if (imageBase && meta.hero) {
        meta.hero = imageBase + meta.hero.trim();
      }      
      return { slug, ...meta, body };
    })
  );

  return items;
}

  return {
    loadCollection,
    bodyToHTML,
    formatDate
  };
})();

