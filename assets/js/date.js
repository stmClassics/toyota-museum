// Globales Datumformat CH
const df = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// Globale Funktion zur Formatierung
function formatDateRange(startStr, endStr) {
  if (!startStr) return "";

  const start = new Date(startStr);
  if (!endStr) return df.format(start);

  const end = new Date(endStr);

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
