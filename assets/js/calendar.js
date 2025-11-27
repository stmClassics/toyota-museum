document.addEventListener("DOMContentLoaded", initCalendar);

async function initCalendar() {
  const container = document.getElementById("calendar-list");
  if (!container) return;

  try {
    // Alle Termine laden
    let items = await CMS.loadCollection("/content/calendar");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Hilfsfunktion: Start/Ende bestimmen
    const parseDate = (str) => str ? new Date(str + "T00:00:00") : null;

    items = items.map(ev => {
      const start = parseDate(ev.date);
      const end   = parseDate(ev.end) || start;
      return { ...ev, start, end };
    });

    // Vergangene Termine rausfiltern:
    // nur Termine, deren END-Datum heute oder in der Zukunft liegt
    const upcoming = items
      .filter(ev => ev.end && ev.end >= today)
      .sort((a, b) => a.start - b.start); // chronologisch

    if (upcoming.length === 0) {
      container.innerHTML = "<p>Derzeit sind keine Termine eingetragen.</p>";
      return;
    }

    // Sehr einfache HTML-Struktur: du kannst das später verfeinern
    const rows = upcoming.map(ev => {
      const dateStr = ev.end && ev.end > ev.start
        ? `${ev.date} – ${ev.end}`
        : ev.date;

      const location = ev.location || "";
      const organizer = ev.organizer || "";
      const type = ev.type || "";
      const link = ev.link ? `<a href="${ev.link}" target="_blank" rel="noopener">Details</a>` : "";

      return `
        <tr>
          <td>${dateStr}</td>
          <td>${ev.title}</td>
          <td>${location}</td>
          <td>${organizer}</td>
          <td>${type}</td>
          <td>${link}</td>
        </tr>
      `;
    }).join("");

    container.innerHTML = `
      <table class="table calendar-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Termin</th>
            <th>Ort</th>
            <th>Veranstalter</th>
            <th>Typ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error("Fehler beim Laden des Kalenders:", err);
  }
}
