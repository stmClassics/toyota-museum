// ===============================
// Datum & Zeit – Zentrale Utils
// ===============================

// Globales Datumformat CH
const df = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// ---------- FORMATIERUNG ----------

// Globale Funktion zur Formatierung von Datumsbereichen
function formatDateRange(startStr, endStr) {
  if (!startStr) return "";

  const start = parseISODateLocal(startStr);
  if (!endStr) return df.format(start);

  const end = parseISODateLocal(endStr);

  // gleiches Datum
  if (start.toDateString() === end.toDateString()) {
    return df.format(start);
  }

  // gleicher Monat & Jahr → 16.–18.05.2026
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    const d1 = String(start.getDate()).padStart(2, "0");
    const d2 = String(end.getDate()).padStart(2, "0");
    const m = String(start.getMonth() + 1).padStart(2, "0");
    const y = start.getFullYear();
    return `${d1}.–${d2}.${m}.${y}`;
  }

  // sonst voller Bereich
  return `${df.format(start)} – ${df.format(end)}`;
}

// ---------- PARSING & LOGIK (NEU) ----------

// Erwartet YYYY-MM-DD (oder ISO-ähnlich), gibt Date um 00:00 lokale Zeit zurück
function parseISODateLocal(str) {
  if (!str) return null;
  return new Date(String(str).slice(0, 10) + "T00:00:00");
}

// Heute 00:00 in Europe/Zurich (robust gegen Browser-Zeitzone)
function todayStartZurich() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  const d = parts.find(p => p.type === "day").value;

  return new Date(`${y}-${m}-${d}T00:00:00`);
}

// ISO-String "YYYY-MM-DD" für Publish-Logik
function todayISOZurich() {
  const d = todayStartZurich();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// true, wenn item.date <= heute (Publish-Datum)
function isPublishedByDate(item, todayISO) {
  if (!item?.date) return false;
  return String(item.date).slice(0, 10) <= todayISO;
}

// ===============================
// Program / Event Date Helpers
// ===============================

// ISO-Date (YYYY-MM-DD) → lokales Datum (00:00)
function parseISODateLocal(str) {
  if (!str) return null;
  return new Date(str + "T00:00:00");
}

// Heute 00:00 (CH)
function todayStartZurich() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Start/End normalisieren
function normalizeDateRange(item) {
  const start = parseISODateLocal(item.start);
  const end = parseISODateLocal(item.end) || start;
  return { ...item, _start: start, _end: end };
}

// Ist Event noch aktuell?
function isOngoingOrUpcoming(item, today = todayStartZurich()) {
  if (!item._end) return false;
  return item._end >= today;
}

// Sortierung: nächstes zuerst
function sortByStartDate(a, b) {
  return a._start - b._start;
}
