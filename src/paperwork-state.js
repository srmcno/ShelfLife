// The corkboard is deliberately ephemeral. Filed documents have their own
// bounded archive so ordinary chatter and clearing the board cannot erase them.
export const PAPERWORK_LIMIT = 120;
export const blankPaperwork = () => ({ version: 1, entries: [] });
const clean = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';
const hash = text => { let n = 2166136261; for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0).toString(36); };
const sceneLabels = { court: 'Verdict', outing: 'Expedition report', market: 'Market receipt', visitor: 'Visitor record', residency: 'Resident milestone' };

function entry(raw) {
  if (!raw || typeof raw !== 'object' || !Number.isFinite(raw.at) || raw.at < 0 || raw.at > 8640000000000000) return null;
  const text = clean(raw.text, 6000), key = clean(raw.key, 220);
  if (!text || !key) return null;
  return { key, title: clean(raw.title, 180) || 'Filed by the household', text,
    from: clean(raw.from, 120) || 'the filing desk', kind: 'note', form: 'doc', at: raw.at,
    cast: Array.isArray(raw.cast) ? [...new Set(raw.cast.filter(id => typeof id === 'string' && /^[\w-]{1,100}$/.test(id)))].slice(0, 18) : [] };
}
function noteDocument(note) {
  if (!note || !['doc', 'list'].includes(note.form)) return null;
  return entry({ ...note, key: 'note:' + note.at + ':' + hash(String(note.from) + '\n' + note.text),
    title: note.form === 'list' ? 'A list of considerable importance' : 'Official household correspondence' });
}
function sceneDocument(scene) {
  if (!scene || !Object.hasOwn(sceneLabels, scene.kind)) return null;
  return entry({ ...scene, key: 'scene:' + scene.id + ':' + scene.at,
    title: sceneLabels[scene.kind] + ' · ' + scene.title, from: scene.kind === 'court' ? 'Shelf Court' : 'the household register' });
}
export function normalizePaperwork(raw, notes = [], scenes = []) {
  const unique = new Map();
  const incoming = [...(Array.isArray(raw?.entries) ? raw.entries.slice(0, PAPERWORK_LIMIT) : []),
    ...notes.slice(0, 40).map(noteDocument), ...scenes.slice(0, 18).map(sceneDocument)];
  for (const candidate of incoming) { const doc = entry(candidate); if (doc && !unique.has(doc.key)) unique.set(doc.key, doc); }
  return { version: 1, entries: [...unique.values()].sort((a, b) => b.at - a.at).slice(0, PAPERWORK_LIMIT) };
}
export function fileDocument(state, document) {
  const doc = entry(document);
  if (!doc) return null;
  if (!state.paperwork || !Array.isArray(state.paperwork.entries)) state.paperwork = blankPaperwork();
  if (state.paperwork.entries.some(item => item.key === doc.key)) return null;
  state.paperwork.entries.unshift(doc);
  state.paperwork.entries.length = Math.min(PAPERWORK_LIMIT, state.paperwork.entries.length);
  return doc;
}
export function fileNote(state, note) { return fileDocument(state, noteDocument(note)); }
export function fileScene(state, scene) { return fileDocument(state, sceneDocument(scene)); }

// An on-demand report records facts already in the save. It awards nothing;
// asking twice without any household changes cannot manufacture new history.
export function householdReport(state, now = Date.now()) {
  if (!state.pets?.length) return null;
  const number = value => Math.max(0, Math.floor(Number(value) || 0));
  const residents = state.pets.map(pet => {
    const slot = state.slots.indexOf(pet.id);
    const place = slot < 0 ? 'unseated' : String.fromCharCode(65 + Math.floor(slot / 6)) + (slot % 6 + 1);
    const care = pet.careLog || {};
    return pet.name + ' · ' + place + '\n  Trust ' + number(pet.bond) + ' · meals ' + number(care.food) + ' · fusses ' + number(care.fuss) + ' · cleans ' + number(care.clean);
  });
  const life = state.life || {};
  const text = 'HOUSEHOLD REGISTER\n' + state.pets.length + (state.pets.length === 1 ? ' resident. One opinion, expressed repeatedly.' : ' residents. Unanimity remains a distant prospect.') + '\n\n' + residents.join('\n\n') +
    '\n\nEXPEDITIONS RETURNED: ' + number(life.outings) + '\nEMERGENCIES SURVIVED: ' + number(state.mayhem?.resolved) + ' · souls in hand ' + number(state.mayhem?.souls) +
    '\nWORKSHOP PROJECTS BUILT: ' + (life.projects?.length || 0) + '\n\nPrepared from the household’s actual records. Nobody was consulted about the wording.';
  return { key: 'register:' + hash(text), title: 'The household register', text, from: 'the filing desk', at: now, cast: state.pets.map(p => p.id) };
}
