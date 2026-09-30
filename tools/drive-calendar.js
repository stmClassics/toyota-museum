'use strict';

// STM Kalender: Google Sheet -> bestehendes TXT/JSON-Format.
//
// Aufruf:
//   node tools/drive-calendar.js
//       = Vorschau, keine Änderungen
//
//   node tools/drive-calendar.js --apply
//       = Kalender vollständig mit Google Drive synchronisieren
//
// Regeln:
// - Google Sheet bestimmt, welche Termine existieren.
// - Abgelaufene Termine werden nicht publiziert.
// - Ein Termin bleibt bis einschliesslich Enddatum sichtbar.
// - Das Tagesdatum wird in Europe/Zurich bestimmt.
// - Nicht mehr benötigte Kalender-TXT-Dateien werden gelöscht.
// - index.json wird vollständig aus dem aktuellen Soll-Zustand erzeugt.

const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'content', 'calendar');
const CREDENTIALS = path.join(
  ROOT,
  'credentials',
  'google-drive-service-account.json'
);

const COLUMNS = [
  'title',
  'start',
  'end',
  'location',
  'organizer',
  'type',
  'link',
  'description'
];

const META = COLUMNS.filter(k => k !== 'description');


/* -------------------------------------------------
   CSV lesen
------------------------------------------------- */

function parseCsv(input) {

  const rows = [];

  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i++) {

    const ch = input[i];

    if (quoted) {

      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      }
      else if (ch === '"') {
        quoted = false;
      }
      else {
        field += ch;
      }

    }
    else if (ch === '"') {

      quoted = true;

    }
    else if (ch === ',') {

      row.push(field);
      field = '';

    }
    else if (ch === '\n' || ch === '\r') {

      if (ch === '\r' && input[i + 1] === '\n') {
        i++;
      }

      row.push(field);

      if (row.some(v => v.trim())) {
        rows.push(row);
      }

      row = [];
      field = '';

    }
    else {

      field += ch;
    }
  }

  if (quoted) {
    throw new Error('CSV: nicht geschlossenes Anführungszeichen');
  }

  row.push(field);

  if (row.some(v => v.trim())) {
    rows.push(row);
  }

  return rows;
}


/* -------------------------------------------------
   Dateiname aus Titel erzeugen
------------------------------------------------- */

function slug(title) {

  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}


/* -------------------------------------------------
   ISO-Datum prüfen
------------------------------------------------- */

function date(value) {

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const d = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === value
  );
}


/* -------------------------------------------------
   Heutiges Datum in der Schweiz
------------------------------------------------- */

function todayZurich() {

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const get = type =>
    parts.find(part => part.type === type).value;

  return `${get('year')}-${get('month')}-${get('day')}`;
}


/* -------------------------------------------------
   CSV in Kalender-Einträge umwandeln
------------------------------------------------- */

function convert(csv) {

  const rows = parseCsv(
    csv.replace(/^\uFEFF/, '')
  );

  if (!rows.length) {
    throw new Error('Tabelle ist leer');
  }

  const header = rows
    .shift()
    .map(s => s.trim().toLowerCase());

  const missing = COLUMNS.filter(
    column => !header.includes(column)
  );

  if (missing.length) {
    throw new Error(
      `Fehlende Spalten: ${missing.join(', ')}`
    );
  }

  if (new Set(header).size !== header.length) {
    throw new Error('Doppelte Spaltennamen');
  }

  const items = new Map();

  rows.forEach((row, index) => {

    const line = index + 2;

    if (
      row.length > header.length &&
      row.slice(header.length).some(v => v.trim())
    ) {
      throw new Error(
        `Zeile ${line}: mehr Werte als Spalten`
      );
    }

    const item = Object.fromEntries(
      COLUMNS.map(column => [
        column,
        (row[header.indexOf(column)] || '').trim()
      ])
    );

    if (
      !item.title ||
      !date(item.start) ||
      !date(item.end) ||
      item.end < item.start
    ) {
      throw new Error(
        `Zeile ${line}: Titel oder Datum ungültig ` +
        `(Datum: JJJJ-MM-TT, Ende >= Beginn)`
      );
    }

    if (
      META.some(column =>
        /[\r\n]/.test(item[column])
      )
    ) {
      throw new Error(
        `Zeile ${line}: Zeilenumbruch in Metadaten`
      );
    }

    if (
      item.link &&
      !/^https?:\/\/\S+$/i.test(item.link)
    ) {
      throw new Error(
        `Zeile ${line}: Link muss mit https:// oder http:// beginnen`
      );
    }

    const itemSlug = slug(item.title);

    if (!itemSlug) {
      throw new Error(
        `Zeile ${line}: Titel ergibt keinen Dateinamen`
      );
    }

    const name =
      `${item.start}-${itemSlug}.txt`;

    if (items.has(name.toLowerCase())) {
      throw new Error(
        `Zeile ${line}: doppelter Dateiname ${name}`
      );
    }

    const text =
      META
        .map(key => `${key}: ${item[key]}`)
        .join('\n') +
      '\n---\n' +
      item.description
        .replace(/\r\n?/g, '\n') +
      '\n';

    items.set(
      name.toLowerCase(),
      {
        name,
        text,
        end: item.end
      }
    );
  });

  return [...items.values()];
}


/* -------------------------------------------------
   Google Drive suchen
------------------------------------------------- */

function escapeQuery(value) {

  return value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'");
}


async function findUnique(
  drive,
  name,
  mimeType,
  parentId = null
) {

  const parts = [
    `name = '${escapeQuery(name)}'`,
    `mimeType = '${mimeType}'`,
    'trashed = false'
  ];

  if (parentId) {
    parts.push(`'${parentId}' in parents`);
  }

  const matches = [];

  let pageToken;

  do {

    const result = await drive.files.list({
      q: parts.join(' and '),
      fields:
        'nextPageToken,files(id,name,mimeType)',
      pageSize: 1000,
      pageToken
    });

    matches.push(
      ...(result.data.files || [])
    );

    pageToken =
      result.data.nextPageToken;

  } while (pageToken);

  if (!matches.length) {
    throw new Error(
      `In Google Drive nicht gefunden: ${name}`
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `Mehrere Treffer fuer "${name}" gefunden. ` +
      `Bitte eindeutige Ordner-/Dateinamen verwenden.`
    );
  }

  return matches[0];
}


/* -------------------------------------------------
   Kalender-Tabelle finden
------------------------------------------------- */

async function findCalendarSheet(drive) {

  const folderType =
    'application/vnd.google-apps.folder';

  const root = await findUnique(
    drive,
    'stm Webseite',
    folderType
  );

  const calendar = await findUnique(
    drive,
    'Kalender',
    folderType,
    root.id
  );

  return findUnique(
    drive,
    'Kalender',
    'application/vnd.google-apps.spreadsheet',
    calendar.id
  );
}


/* -------------------------------------------------
   Import
------------------------------------------------- */

async function run() {

  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  if (
    args.some(arg => arg !== '--apply')
  ) {
    throw new Error(
      'Aufruf: node tools/drive-calendar.js [--apply]'
    );
  }


  const { google } = require('googleapis');

  const auth =
    new google.auth.GoogleAuth({
      keyFile: CREDENTIALS,
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly'
      ]
    });

  const drive =
    google.drive({
      version: 'v3',
      auth
    });


  /* -----------------------------------------------
     Tabelle aus Google Drive laden
  ------------------------------------------------ */

  const sheet =
    await findCalendarSheet(drive);

  console.log(
    'Gefunden: stm Webseite / Kalender / Kalender'
  );

  // Das Blatt "Termine" muss weiterhin
  // das erste Tabellenblatt sein.
  const response =
    await drive.files.export(
      {
        fileId: sheet.id,
        mimeType: 'text/csv'
      },
      {
        responseType: 'text'
      }
    );


  /* -----------------------------------------------
     Daten prüfen und abgelaufene Termine entfernen
  ------------------------------------------------ */

  const allItems =
    convert(String(response.data));

  const today =
    todayZurich();

  const items =
    allItems.filter(
      item => item.end >= today
    );

  const expiredCount =
    allItems.length - items.length;

  console.log(
    `Heute (Europe/Zurich): ${today}`
  );

  console.log(
    `${allItems.length} Kalenderzeilen; ` +
    `${items.length} aktuell/zukünftig; ` +
    `${expiredCount} abgelaufen.`
  );


  /* -----------------------------------------------
     Bestehende Kalender-Dateien feststellen
  ------------------------------------------------ */

  const indexPath =
    path.join(OUT, 'index.json');

  const wantedNames =
    new Set(
      items.map(
        item => item.name.toLowerCase()
      )
    );

  let existingFiles = [];

  try {

    existingFiles =
      (await fs.readdir(OUT))
        .filter(
          name =>
            name
              .toLowerCase()
              .endsWith('.txt')
        );

  }
  catch (error) {

    if (error.code !== 'ENOENT') {
      throw error;
    }
  }


  /* -----------------------------------------------
     Zu löschende Dateien feststellen
  ------------------------------------------------ */

  const deletions =
    existingFiles.filter(
      name =>
        !wantedNames.has(
          name.toLowerCase()
        )
    );


  /* -----------------------------------------------
     Änderungen ermitteln
  ------------------------------------------------ */

  let newCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;

  for (const item of items) {

    const target =
      path.join(OUT, item.name);

    let current = null;

    try {

      current =
        await fs.readFile(
          target,
          'utf8'
        );

    }
    catch (error) {

      if (error.code !== 'ENOENT') {
        throw error;
      }
    }


    if (current === null) {

      newCount++;

      console.log(
        `NEU     ${item.name}`
      );

    }
    else if (current === item.text) {

      unchangedCount++;

      console.log(
        `GLEICH  ${item.name}`
      );

    }
    else {

      changedCount++;

      console.log(
        `ÄNDERN  ${item.name}`
      );
    }
  }


  for (const name of deletions) {

    console.log(
      `LÖSCHEN ${name}`
    );
  }


  console.log(
    '\nKalender: ' +
    `${newCount} neu, ` +
    `${changedCount} geändert, ` +
    `${unchangedCount} unverändert, ` +
    `${deletions.length} zu löschen.`
  );


  /* -----------------------------------------------
     Gemeinsamen Importbericht ergänzen
  ------------------------------------------------ */

  const reportPath =
    path.join(ROOT, '_import-result.json');

  let report = {
    mode: apply ? 'import' : 'preview',
    problems: []
  };

  try {

    report =
      JSON.parse(
        await fs.readFile(
          reportPath,
          'utf8'
        )
      );

  }
  catch (error) {

    if (error.code !== 'ENOENT') {
      throw new Error(
        `Importbericht konnte nicht gelesen werden: ${error.message}`
      );
    }
  }

  report.calendar = {
    totalRows: allItems.length,
    activeItems: items.length,
    expiredItems: expiredCount,
    newFiles: newCount,
    changedFiles: changedCount,
    unchangedFiles: unchangedCount,
    deletedFiles: deletions.length
  };

  await fs.writeFile(
    reportPath,
    JSON.stringify(
      report,
      null,
      2
    ) + '\n',
    'utf8'
  );


  /* -----------------------------------------------
     Vorschau endet hier
  ------------------------------------------------ */

  if (!apply) {

    console.log(
      '\nNur Vorschau. Mit --apply schreiben.'
    );

    return;
  }


  /* -----------------------------------------------
     Änderungen schreiben
  ------------------------------------------------ */

  await fs.mkdir(
    OUT,
    { recursive: true }
  );


  for (const item of items) {

    const target =
      path.join(OUT, item.name);

    let current = null;

    try {

      current =
        await fs.readFile(
          target,
          'utf8'
        );

    }
    catch (error) {

      if (error.code !== 'ENOENT') {
        throw error;
      }
    }


    if (current !== item.text) {

      await fs.writeFile(
        target,
        item.text,
        'utf8'
      );
    }
  }


  /* -----------------------------------------------
     Nicht mehr gültige Termine löschen
  ------------------------------------------------ */

  for (const name of deletions) {

    await fs.rm(
      path.join(OUT, name)
    );
  }


  /* -----------------------------------------------
     Index komplett neu erzeugen
  ------------------------------------------------ */

  await fs.writeFile(
    indexPath,
    JSON.stringify(
      {
        entries:
          items.map(
            item => item.name
          )
      },
      null,
      2
    ) + '\n',
    'utf8'
  );


  console.log(
    '\nKalender vollständig mit Google-Tabelle synchronisiert.'
  );
}


/* -------------------------------------------------
   Start
------------------------------------------------- */

if (require.main === module) {

  run().catch(error => {

    console.error(
      'FEHLER:',
      error.message
    );

    process.exitCode = 1;
  });
}


module.exports = {
  parseCsv,
  slug,
  convert,
  todayZurich
};