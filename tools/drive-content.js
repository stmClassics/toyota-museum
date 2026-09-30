// STM: Google-Drive-Inhaltsordner -> bestehendes TXT/JSON-CMS.
// node tools/drive-content.js          = Vorschau
// node tools/drive-content.js --apply  = Import inkl. sicherem Abgleich/Löschungen
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { google } = require('googleapis');
const ROOT = path.resolve(__dirname, '..');
const KEY = path.join(ROOT, 'credentials/google-drive-service-account.json');
const FOLDER = 'application/vnd.google-apps.folder';
const DOC = 'application/vnd.google-apps.document';
const CONFIG = [
  { drive: 'Autos', local: 'cars', nestedImages: true },
  { drive: 'Geschichten', local: 'insights', nestedImages: true },
  { drive: 'Programm', local: 'program', nestedImages: false },
];
const apply = process.argv.includes('--apply');
if (process.argv.slice(2).some(arg => arg !== '--apply')) {
  console.error('Aufruf: node tools/drive-content.js [--apply]');
  process.exit(1);
}
function safeName(name) {
  if (!name || name === '.' || name === '..' || /[\\/\x00-\x1f]/.test(name) || name.includes('..') || name.startsWith('.')) {
    throw new Error(`Unsicherer Dateiname: ${JSON.stringify(name)}`);
  }
  return name;
}
// Google Drive kann temporäre Editor-/Synchronisationsdateien enthalten.
// Diese Dateien weder herunterladen noch in die images:-Liste aufnehmen.
function isTemporaryFile(name) {
  return /~RF[0-9a-f]+\.TMP$/i.test(name) || /^~\$/.test(name) || /\.tmp$/i.test(name);
}
function queryEscape(s) { return s.replaceAll('\\', '\\\\').replaceAll("'", "\\'"); }
async function list(drive, parent) {
  const files = []; let pageToken;
  do {
    const response = await drive.files.list({
      q: `'${parent}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,modifiedTime)',
      pageSize: 1000, pageToken,
    });
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  return files;
}
async function uniqueRoot(drive) {
  const matches = []; let pageToken;
  do {
    const response = await drive.files.list({
      q: `name = '${queryEscape('stm Webseite')}' and mimeType = '${FOLDER}' and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType)', pageSize: 1000, pageToken,
    });
    matches.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  if (matches.length !== 1) throw new Error(`Ordner "stm Webseite": ${matches.length} Treffer statt 1`);
  return matches[0];
}
function uniqueChild(items, name, mime) {
  const found = items.filter(item => item.name === name && item.mimeType === mime);
  if (found.length !== 1) throw new Error(`Ordner "${name}": ${found.length} Treffer statt 1`);
  return found[0];
}
function filename(doc) {
  const name = safeName(doc.name);
  return name.toLowerCase().endsWith('.txt') ? name : name + '.txt';
}
function metadataAndBody(source, images, pdf) {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const separator = /^---\s*$/m.exec(text);
  if (!separator) throw new Error('Google Doc hat keine Trennlinie ---');
  const head = text.slice(0, separator.index).split('\n');
  const body = text.slice(separator.index + separator[0].length);
  const fields = head.filter(line => !/^\s*(images|pdf)\s*:/i.test(line) && line.trim());
  if (!fields.some(line => /^title\s*:\s*\S/i.test(line))) throw new Error('Google Doc ohne title:');
  if (images.length) fields.push(`images: ${images.join(', ')}`);
  if (pdf) fields.push(`pdf: ${pdf}`);
  return fields.join('\n') + '\n---' + body.replace(/^\n*/, '\n').replace(/\n*$/, '\n');
}
function assetRefsFromText(content) {
  const text = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const separator = /^---\s*$/m.exec(text);
  const head = (separator ? text.slice(0, separator.index) : text).split('\n');
  const images = [];
  let pdf = '';
  for (const line of head) {
    const imageMatch = /^\s*images\s*:\s*(.*)$/i.exec(line);
    if (imageMatch) {
      images.push(...imageMatch[1].split(',').map(v => v.trim()).filter(Boolean));
      continue;
    }
    const pdfMatch = /^\s*pdf\s*:\s*(.*)$/i.exec(line);
    if (pdfMatch) pdf = pdfMatch[1].trim();
  }
  return { images, pdf };
}
function safeAssetTarget(base, relativeName) {
  if (!relativeName || path.isAbsolute(relativeName) || relativeName.includes('\0'))
    throw new Error(`Unsicherer Asset-Pfad: ${JSON.stringify(relativeName)}`);
  const target = path.resolve(base, relativeName.replaceAll('/', path.sep));
  const root = path.resolve(base) + path.sep;
  if (!target.startsWith(root)) throw new Error(`Unsicherer Asset-Pfad: ${JSON.stringify(relativeName)}`);
  return target;
}
async function exportDoc(drive, file) {
  const response = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' }, { responseType: 'text' });
  return String(response.data);
}
async function fileStatus(target, content) {
  try { return (await fs.readFile(target, 'utf8')) === content ? 'gleich' : 'ändern'; }
  catch (error) { if (error.code === 'ENOENT') return 'neu'; throw error; }
}
async function binaryStatus(target, file) {
  try {
    const stat = await fs.stat(target);
    return new Date(file.modifiedTime).getTime() > stat.mtimeMs + 1000 ? 'ändern' : 'gleich';
  } catch (error) { if (error.code === 'ENOENT') return 'neu'; throw error; }
}
async function atomicText(target, content) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  try { await fs.writeFile(temp, content, { flag: 'wx' }); await fs.rename(temp, target); }
  finally { await fs.rm(temp, { force: true }); }
}
async function download(drive, file, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  try {
    const response = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' });
    const { createWriteStream } = require('node:fs');
    await pipeline(response.data, createWriteStream(temp, { flags: 'wx' }));
    await fs.rename(temp, target);
    const date = new Date(file.modifiedTime);
    if (!Number.isNaN(date.getTime())) await fs.utimes(target, date, date);
  } finally { await fs.rm(temp, { force: true }); }
}
async function deletionPlan(base, entry, protectedTargets) {
  const txtName = safeName(entry);
  const txtTarget = path.join(base, txtName);
  const targets = new Set([txtTarget]);
  let content;
  try {
    content = await fs.readFile(txtTarget, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { entry: txtName, targets: [txtTarget] };
    throw error;
  }
  const refs = assetRefsFromText(content);
  for (const image of refs.images) targets.add(safeAssetTarget(path.join(base, 'images'), image));
  if (refs.pdf) targets.add(safeAssetTarget(path.join(base, 'pdf'), refs.pdf));
  return {
    entry: txtName,
    targets: [...targets].filter(target => !protectedTargets.has(target.toLowerCase())),
  };
}
// Leere Inhaltsordner gelten als Entwurf/Platzhalter und werden ignoriert.
// Echte Fehler in einem Inhaltsordner blockieren vorsichtshalber Löschungen im betroffenen Bereich.
async function planSection(drive, rootChildren, cfg, problems) {
  const section = uniqueChild(rootChildren, cfg.drive, FOLDER);
  const folders = (await list(drive, section.id)).filter(f => f.mimeType === FOLDER)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const base = path.join(ROOT, 'content', cfg.local);
  const indexPath = path.join(base, 'index.json');
  let index;
  try { index = JSON.parse(await fs.readFile(indexPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; index = { entries: [] }; }
  if (!Array.isArray(index.entries) || !index.entries.every(x => typeof x === 'string'))
    throw new Error(`${indexPath}: entries ist keine Liste von Dateinamen`);
  const reserved = new Set();
  const plans = [];
  let reconciliationBlocked = false;
  const blockReasons = [];
  console.log(`\n${cfg.drive} -> content/${cfg.local} (${folders.length} Inhaltsordner)`);
  for (const folder of folders) {
    const label = `${cfg.drive}/${folder.name}`;
    try {
      const children = await list(drive, folder.id);
      const docs = children.filter(f => f.mimeType === DOC);
      if (docs.length === 0) {
        console.warn(`  HINWEIS ${label}: noch kein Google Doc – als Entwurf/Platzhalter übersprungen`);
        continue;
      }
      if (docs.length > 1) throw new Error(`erwartet 1 Google Doc, gefunden ${docs.length}`);
      const doc = docs[0];
      const txtName = filename(doc);
      const images = children.filter(f => f.mimeType.startsWith('image/') && !isTemporaryFile(f.name))
        .sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
      const pdfs = children.filter(f => f.mimeType === 'application/pdf' && !isTemporaryFile(f.name));
      if (pdfs.length > 1) throw new Error('mehrere PDFs; bitte Regel festlegen');
      const imageFolder = cfg.nestedImages ? path.parse(txtName).name : '';
      const imageNames = images.map(f => cfg.nestedImages ? `${imageFolder}/${safeName(f.name)}` : safeName(f.name));
      const pdfName = pdfs.length ? safeName(pdfs[0].name) : '';
      const targetTxt = path.join(base, txtName);
      const actions = [];
      const content = metadataAndBody(await exportDoc(drive, doc), imageNames, pdfName);
      // Zuerst alle Dateien dieses Eintrags prüfen; bei Fehler nichts reservieren.
      for (const image of images) {
        const target = path.join(base, 'images', imageFolder, safeName(image.name));
        actions.push({ state: await binaryStatus(target, image), target, file: image, kind: 'binary' });
      }
      for (const pdf of pdfs) {
        const target = path.join(base, 'pdf', pdfName);
        actions.push({ state: await binaryStatus(target, pdf), target, file: pdf, kind: 'binary' });
      }
      actions.push({ state: await fileStatus(targetTxt, content), target: targetTxt, content, kind: 'text' });
      const keys = actions.map(a => a.target.toLowerCase());
      if (new Set(keys).size !== keys.length || keys.some(k => reserved.has(k)))
        throw new Error('doppelte Zieldatei (Name bereits von anderem Inhalt verwendet)');
      keys.forEach(k => reserved.add(k));
      plans.push({ label, txtName, actions });
      for (const action of actions) console.log(`  ${action.state.padEnd(7)} ${path.relative(ROOT, action.target)}`);
    } catch (error) {
      reconciliationBlocked = true;
      blockReasons.push(`${label}: ${error.message}`);
      problems.push({ label, message: error.message });
      console.warn(`  WARNUNG ${label}: ${error.message} – übersprungen; Löschabgleich für ${cfg.drive} gesperrt`);
    }
  }
  const wantedEntries = new Set(plans.map(plan => plan.txtName.toLowerCase()));
  const staleEntries = reconciliationBlocked
    ? []
    : index.entries.filter(entry => !wantedEntries.has(entry.toLowerCase()));
  const protectedTargets = new Set(plans.flatMap(plan => plan.actions.map(action => action.target.toLowerCase())));
  const deletions = [];
  if (!reconciliationBlocked) {
    for (const entry of staleEntries) deletions.push(await deletionPlan(base, entry, protectedTargets));
    for (const deletion of deletions) {
      console.log(`  LÖSCHEN ${path.relative(ROOT, path.join(base, deletion.entry))}`);
      for (const target of deletion.targets) {
        if (target === path.join(base, deletion.entry)) continue;
        console.log(`           ${path.relative(ROOT, target)}`);
      }
    }
  } else {
    console.warn(`  HINWEIS ${cfg.drive}: keine Löschungen in diesem Lauf (${blockReasons.length} fehlerhafte Ordner).`);
  }
  return { cfg, base, index, indexPath, plans, deletions, reconciliationBlocked, blockReasons };
}
async function main() {
  console.log(`STM Content-Import: ${apply ? 'SCHREIBEN' : 'VORSCHAU (keine Änderungen)'}`);
  const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  const drive = google.drive({ version: 'v3', auth });
  const root = await uniqueRoot(drive);
  const rootChildren = await list(drive, root.id);
  const problems = [];
  const sections = [];
  // Fehler in der Drive-Verbindung, Bereichsstruktur oder index.json sind globale Fehler.
  for (const cfg of CONFIG) sections.push(await planSection(drive, rootChildren, cfg, problems));
  const plans = sections.flatMap(s => s.plans);
  const allActions = plans.flatMap(p => p.actions);
  const deletions = sections.flatMap(s => s.deletions);
  console.log(`\nGeprüft: ${plans.length} gültige Inhalte; ${allActions.filter(a => a.state === 'neu').length} neue, ${allActions.filter(a => a.state === 'ändern').length} geänderte, ${allActions.filter(a => a.state === 'gleich').length} unveränderte Dateien; ${deletions.length} Inhalte zu löschen.`);
  const changedContents = plans.filter(plan =>
    plan.actions.some(action => action.state === 'neu' || action.state === 'ändern')
  ).length;
  const result = {
    mode: apply ? 'import' : 'preview',
    validContents: plans.length,
    changedContents,
    deletedContents: deletions.length,
    newFiles: allActions.filter(a => a.state === 'neu').length,
    changedFiles: allActions.filter(a => a.state === 'ändern').length,
    unchangedFiles: allActions.filter(a => a.state === 'gleich').length,
    deletedFiles: deletions.reduce((sum, deletion) => sum + deletion.targets.length, 0),
    deletionBlockedSections: sections.filter(s => s.reconciliationBlocked).map(s => s.cfg.drive),
    problems: []
  };
  if (apply) {
    for (const section of sections) {
      const successfulEntries = [];
      let completed = 0;
      for (const plan of section.plans) {
        try {
          // Bilder/PDFs zuerst, TXT zuletzt. Bei Downloadfehler TXT und Index unverändert.
          for (const action of plan.actions) {
            if (action.state === 'gleich') continue;
            if (action.kind === 'binary') await download(drive, action.file, action.target);
            else await atomicText(action.target, action.content);
          }
          successfulEntries.push(plan.txtName);
          completed++;
        } catch (error) {
          problems.push({ label: plan.label, message: `Import fehlgeschlagen: ${error.message}` });
          console.warn(`  WARNUNG ${plan.label}: Import fehlgeschlagen – ${error.message}`);
        }
      }
      // Löschungen nur ausführen, wenn der Bereich bereits in der Planung vollständig war
      // UND alle geplanten Inhalte erfolgreich geschrieben werden konnten.
      const canDelete = !section.reconciliationBlocked && successfulEntries.length === section.plans.length;
      if (canDelete) {
        for (const deletion of section.deletions) {
          for (const target of deletion.targets) await fs.rm(target, { force: true });
          // Bei verschachtelten Bildern bleibt nach dem Löschen ggf. ein leerer Ordner zurück.
          if (section.cfg.nestedImages) {
            const imageDir = path.join(section.base, 'images', path.parse(deletion.entry).name);
            try { await fs.rmdir(imageDir); } catch (error) { if (!['ENOENT', 'ENOTEMPTY'].includes(error.code)) throw error; }
          }
        }
      } else if (section.deletions.length) {
        console.warn(`  HINWEIS ${section.cfg.drive}: geplante Löschungen wegen Importfehlern nicht ausgeführt.`);
      }
      // Bei gesperrtem Löschabgleich alte Index-Einträge behalten. Sonst ist Drive die Wahrheit.
      let entries;
      if (section.reconciliationBlocked || !canDelete) {
        entries = [...section.index.entries];
        for (const name of successfulEntries) {
          if (!entries.some(entry => entry.toLowerCase() === name.toLowerCase())) entries.push(name);
        }
      } else {
        entries = successfulEntries;
      }
      const indexContent = JSON.stringify({ ...section.index, entries }, null, 2) + '\n';
      if (await fileStatus(section.indexPath, indexContent) !== 'gleich') await atomicText(section.indexPath, indexContent);
      console.log(`${section.cfg.drive}: ${completed} Inhalte verarbeitet, ${canDelete ? section.deletions.length : 0} gelöscht, Index aktualisiert.`);
    }
  } else console.log('Vorschau beendet. Import mit --apply.');
  console.log(`\nIMPORTBERICHT: ${plans.length} gültige Inhalte, ${deletions.length} zu löschen, ${problems.length} Problem(e).`);
  for (const problem of problems) console.log(`  ! ${problem.label}: ${problem.message}`);
  result.problems = problems;
  await fs.writeFile(
    path.join(ROOT, '_import-result.json'),
    JSON.stringify(result, null, 2) + '\n',
    'utf8'
  );
  if (problems.length) process.exitCode = 2;
  if (apply) console.log('Import beendet. Drive ist Master; sicher erkannte verwaiste Inhalte wurden entfernt.');
}
if (require.main === module) main().catch(error => { console.error('GESAMTABBRUCH:', error.message); process.exitCode = 1; });
module.exports = { metadataAndBody, filename, planSection, isTemporaryFile, assetRefsFromText };
