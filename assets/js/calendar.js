document.addEventListener("DOMContentLoaded", initCalendar);

async function initCalendar() {
  const container = document.getElementById("calendar-list");
  if (!container || !window.CMS) return;

  try {
    let items = await CMS.loadCollection("/content/calendar");

    const today = todayStartZurich();

    items = items
      .map(normalizeDateRange)
      .filter((ev) => isOngoingOrUpcoming(ev, today))
      .sort(sortByStartDate);

    if (items.length === 0) {
      container.innerHTML = "<p>Derzeit sind keine Termine eingetragen.</p>";
      return;
    }

    const rows = items
      .map((ev) => {
        const dateStr = formatDateRange(ev.start, ev.end);
        const location = ev.location || "";
        const organizer = ev.organizer || "";
        const type = ev.type || "";
        const link = ev.link
          ? `<a href="${ev.link}" target="_blank" rel="noopener">Details</a>`
          : "";

        return `
          <tr>
            <td>${dateStr}</td>
            <td>${ev.title || ""}</td>
            <td>${location}</td>
            <td>${organizer}</td>
            <td>${type}</td>
            <td>${link}</td>
          </tr>
        `;
      })
      .join("");

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
    container.innerHTML = "<p>Fehler beim Laden des Kalenders.</p>";
  }
}
