// Kin on the resident card: where a foundling came from, a small family tree
// across shelves, and the letters this resident has kept. Read only, built
// from the household's own record (kin-state.js), so it works offline.
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const shelfOf = p => (p.shelf ? p.shelf + '’s shelf' : 'a friend’s shelf');
const dateOf = ms => ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

function kinOf(state) { return state && typeof state.kin === 'object' && state.kin ? state.kin : { foundlings: [], letters: [] }; }
const here = (state, id) => (state.pets || []).find(p => p.id === id) || null;
// "Mabel (yours)", "Mabel (yours, rehomed)" or "Grubbs (Bea’s shelf)".
export function parentLabel(state, p) {
  if (!p.home) return p.name + ' (' + shelfOf(p) + ')';
  const pet = here(state, p.id);
  return (pet?.name || p.name) + (pet ? ' (yours)' : ' (yours, rehomed)');
}
export function foundOnStep(state, record) {
  return 'Found on the step. Parents: ' + parentLabel(state, record.parents[0]) + ' and ' + parentLabel(state, record.parents[1]) + '.';
}

function node(name, where, cls = '') {
  return '<span class="kin-node' + cls + '"><b>' + escapeHtml(name) + '</b><small>' + escapeHtml(where) + '</small></span>';
}
// Parents above, the child and its twin below; then any children of its own.
export function familyTreeHTML(state, pet) {
  const kin = kinOf(state);
  const own = kin.foundlings.find(f => f.pet === pet.id);
  const children = kin.foundlings.filter(f => f.pet !== pet.id && f.parents.some(p => p.home && p.id === pet.id));
  if (!own && !children.length) return '';
  let html = '';
  if (own) {
    const [a, b] = own.parents;
    const grand = p => {
      const record = p.home ? kin.foundlings.find(f => f.pet === p.id) : null;
      return record ? '<span class="kin-grand">' + escapeHtml('Itself found on the step: ' + record.parents.map(x => x.name).join(' and ')) + '</span>' : '';
    };
    html += '<div class="kin-tree" role="group" aria-label="' + escapeHtml(pet.name + '’s parents') + '"><div class="kin-tree-row kin-tree-parents">' +
      '<div>' + node(here(state, a.id)?.name && a.home ? here(state, a.id).name : a.name, a.home ? (here(state, a.id) ? 'yours' : 'yours, rehomed') : shelfOf(a)) + grand(a) + '</div>' +
      '<div>' + node(here(state, b.id)?.name && b.home ? here(state, b.id).name : b.name, b.home ? (here(state, b.id) ? 'yours' : 'yours, rehomed') : shelfOf(b)) + grand(b) + '</div></div>' +
      '<div class="kin-tree-joint" aria-hidden="true"></div><div class="kin-tree-row kin-tree-kids">' + node(pet.name, 'here', ' kin-node-self') +
      node('Its twin', own.twin.shelf ? own.twin.shelf + '’s shelf' : 'the other shelf', ' kin-node-twin') + '</div></div>';
  }
  if (children.length) {
    html += '<p class="kin-tree-title">' + escapeHtml(pet.name + '’s foundlings') + '</p><ul class="kin-children">' + children.map(f => {
      const other = f.parents.find(p => !(p.home && p.id === pet.id)) || f.parents[1];
      const child = here(state, f.pet);
      return '<li>' + escapeHtml((child?.name || f.name) + (child ? '' : ' (no longer here)') + ', with ' + parentLabel(state, other) + (f.born ? ', ' + dateOf(f.born) : '') + '.') + '</li>';
    }).join('') + '</ul>';
  }
  return html;
}

function paragraphs(text) {
  return String(text).split(/\n{2,}/).map(p => '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>').join('');
}
export function letterHTML(letter, { compact = false } = {}) {
  return '<article class="kin-paper' + (compact ? ' kin-paper-compact' : '') + '" data-kin-letter="' + escapeHtml(letter.id) + '">' + paragraphs(letter.text) + '</article>';
}
// Letters kept by this resident, grouped by who they write to, newest first.
export function correspondenceHTML(state, pet) {
  const letters = kinOf(state).letters.filter(l => l.mine === pet.id);
  if (!letters.length) return '';
  const pals = new Map();
  for (const l of letters) { if (!pals.has(l.pal)) pals.set(l.pal, []); pals.get(l.pal).push(l); }
  const groups = [...pals.values()].map(list => {
    const last = list[list.length - 1];
    const rows = list.slice().reverse().slice(0, 10).map(l => '<li class="kin-kept" data-dir="' + l.dir + '"><p class="kin-kept-meta">' +
      escapeHtml((l.dir === 'in' ? 'From ' + l.theirs : 'To ' + l.theirs) + (l.at ? ', ' + dateOf(l.at) : '') + (l.dir === 'in' && !l.read ? ', unopened' : '')) + '</p>' +
      letterHTML(l, { compact: true }) + '</li>').join('');
    return '<section class="kin-pal-group"><h4>' + escapeHtml('With ' + last.theirs + ', of ' + (last.shelf ? last.shelf + '’s shelf' : 'a friend’s shelf')) + '</h4><ol class="kin-kept-list">' + rows + '</ol></section>';
  }).join('');
  return '<details class="kin-card-letters" id="kinLetters"><summary id="kinLettersSummary">Correspondence <small>' + letters.length + '</small></summary>' + groups + '</details>';
}

export function kinCardHTML(state, pet) {
  if (!pet) return '';
  const record = kinOf(state).foundlings.find(f => f.pet === pet.id);
  const tree = familyTreeHTML(state, pet);
  return (record ? '<p class="kin-found">' + escapeHtml(foundOnStep(state, record)) + '</p>' : '') +
    (tree ? '<details class="kin-card-tree" id="kinTree"' + (record ? ' open' : '') + '><summary id="kinTreeSummary">Family tree</summary>' + tree + '</details>' : '') +
    correspondenceHTML(state, pet);
}
