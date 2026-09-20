// STM Kalender: Google Sheet -> bestehendes TXT/JSON-Format.
// Aufruf im Website-Projekt: node tools/drive-calendar.js [--apply]
// Ohne --apply: Vorschau, keine Änderungen.
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'content', 'calendar'); // bei abweichendem Pfad anpassen
const CREDENTIALS = path.join(ROOT, 'credentials', 'google-drive-service-account.json');
const COLUMNS = ['title', 'start', 'end', 'location', 'organizer', 'type', 'link', 'description'];
const META = COLUMNS.filter(k => k !== 'description');

function parseCsv(input) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field); if (row.some(v => v.trim())) rows.push(row);
      row = []; field = '';
    } else field += ch;
  }
  if (quoted) throw new Error('CSV: nicht geschlossenes Anführungszeichen');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
function slug(title) {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/ø/g, 'o')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function date(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function convert(csv) {
  const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
  if (!rows.length) throw new Error('Tabelle ist leer');
  const header = rows.shift().map(s => s.trim().toLowerCase());
  const missing = COLUMNS.filter(c => !header.includes(c));
  if (missing.length) throw new Error(`Fehlende Spalten: ${missing.join(', ')}`);
  if (new Set(header).size !== header.length) throw new Error('Doppelte Spaltennamen');
  const items = new Map();
  rows.forEach((row, index) => {
    const line = index + 2;
    if (row.length > header.length && row.slice(header.length).some(v => v.trim()))
      throw new Error(`Zeile ${line}: mehr Werte als Spalten`);
    const item = Object.fromEntries(COLUMNS.map(c => [c, (row[header.indexOf(c)] || '').trim()]));
    if (!item.title || !date(item.start) || !date(item.end) || item.end < item.start)
      throw new Error(`Zeile ${line}: Titel oder Datum ungültig (Datum: JJJJ-MM-TT, Ende >= Beginn)`);
    if (META.some(c => /[\r\n]/.test(item[c])))
      throw new Error(`Zeile ${line}: Zeilenumbruch in Metadaten`);
    if (item.link && !/^https?:\/\/\S+$/i.test(item.link))
      throw new Error(`Zeile ${line}: Link muss mit https:// oder http:// beginnen`);
    const name = `${item.start}-${slug(item.title)}.txt`;
    if (!slug(item.title)) throw new Error(`Zeile ${line}: Titel ergibt keinen Dateinamen`);
    if (items.has(name.toLowerCase())) throw new Error(`Zeile ${line}: doppelter Dateiname ${name}`);
    const text = META.map(k => `${k}: ${item[k]}`).join('\n') + '\n---\n' + item.description.replace(/\r\n?/g, '\n') + '\n';
    items.set(name.toLowerCase(), { name, text });
  });
  return [...items.values()];
}
// Gleiche Ordnersuche wie im erfolgreichen Programm-Test, mit Paginierung und
// eindeutiger Auswahl (keine zufaellige Datei bei doppelten Namen).
function escapeQuery(value) { return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'"); }
async function findUnique(drive, name, mimeType, parentId = null) {
  const parts = [`name = '${escapeQuery(name)}'`, `mimeType = '${mimeType}'`, 'trashed = false'];
  if (parentId) parts.push(`'${parentId}' in parents`);
  const matches = [];
  let pageToken;
  do {
    const result = await drive.files.list({ q: parts.join(' and '), fields: 'nextPageToken,files(id,name,mimeType)', pageSize: 1000, pageToken });
    matches.push(...(result.data.files || []));
    pageToken = result.data.nextPageToken;
  } while (pageToken);
  if (!matches.length) throw new Error(`In Google Drive nicht gefunden: ${name}`);
  if (matches.length > 1) throw new Error(`Mehrere Treffer fuer "${name}" gefunden. Bitte eindeutige Ordner-/Dateinamen verwenden.`);
  return matches[0];
}
async function findCalendarSheet(drive) {
  const folderType = 'application/vnd.google-apps.folder';
  const root = await findUnique(drive, 'stm Webseite', folderType);
  const calendar = await findUnique(drive, 'Kalender', folderType, root.id);
  return findUnique(drive, 'Kalender', 'application/vnd.google-apps.spreadsheet', calendar.id);
}
async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  if (args.some(a => a !== '--apply')) {
    throw new Error('Aufruf: node tools/drive-calendar.js [--apply]');
  }
  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({ keyFile: CREDENTIALS, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  const drive = google.drive({ version: 'v3', auth });
  const sheet = await findCalendarSheet(drive);
  console.log('Gefunden: stm Webseite / Kalender / Kalender');
  // CSV-Export: Das Blatt "Termine" muss das erste Tabellenblatt sein.
  const response = await drive.files.export({ fileId: sheet.id, mimeType: 'text/csv' }, { responseType: 'text' });
  const items = convert(String(response.data));
  const indexPath = path.join(OUT, 'index.json');
  let old = { entries: [] };
  try { old = JSON.parse(await fs.readFile(indexPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!Array.isArray(old.entries) || old.entries.some(n => typeof n !== 'string'))
    throw new Error('Bestehende index.json: entries ist keine Dateinamenliste');
  const existing = new Set(old.entries.map(n => n.toLowerCase()));
  const additions = items.map(i => i.name).filter(n => !existing.has(n.toLowerCase()));
  console.log(`${items.length} Kalenderzeilen; ${additions.length} neue Index-Einträge.`);
  for (const item of items) {
    let current = null;
    try { current = await fs.readFile(path.join(OUT, item.name), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    console.log(`${current === null ? 'NEU' : current === item.text ? 'GLEICH' : 'ÄNDERN'} ${item.name}`);
  }
  if (!apply) { console.log('Nur Vorschau. Mit --apply schreiben.'); return; }
  await fs.mkdir(OUT, { recursive: true });
  for (const item of items) {
    const target = path.join(OUT, item.name);
    let current = null;
    try { current = await fs.readFile(target, 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (current !== item.text) await fs.writeFile(target, item.text, 'utf8');
  }
  if (additions.length || !(await fs.stat(indexPath).catch(() => null))) {
    await fs.writeFile(indexPath, JSON.stringify({ ...old, entries: [...old.entries, ...additions] }, null, 2) + '\n');
  }
  console.log('Import abgeschlossen. Alte Dateien/Index-Einträge wurden NICHT gelöscht.');
}
if (require.main === module) run().catch(e => { console.error('FEHLER:', e.message); process.exitCode = 1; });
module.exports = { parseCsv, slug, convert };
