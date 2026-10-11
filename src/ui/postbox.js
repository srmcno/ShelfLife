// Visits, treats, guestbooks and waves in the Friends hub, plugged in through
// src/ui/social-registry.js like any other feature: four postbox sources, four
// friend actions, three home sections, one profile section and the views
// they open. The words are in src/content/postbox.js, the rules in
// src/engine/visits.js and the calls in src/cloud/postbox.js.
import { registerPostboxSource, registerFriendAction, registerFriendsSection, registerSocialView } from './social-registry.js';
import { esc, friendName } from './friends.js';
import { timeAgo } from './cloud.js';
import { curioSVG } from '../art/curios.js';
import { boxCounts } from '../cloud/postbox.js';
import { applyPostbox, collectEnding, collectGift, fill, souvenirInfo, dropDepartedGuests } from '../engine/visits.js';
import {
  TREATS, TREAT_BY_ID, GUESTBOOK_LINES, STAMPS, WAVE_LINES, POKE_LINES, VISIT_DAYS, DAY_WORDS, GIFT_SOULS
} from '../content/postbox.js';

const HOUR = 3600000, DAY = 86400000;
export function leftWords(ms) {
  if (ms <= HOUR) return 'within the hour';
  if (ms < DAY) { const h = Math.round(ms / HOUR); return h === 1 ? 'an hour' : h + ' hours'; }
  const d = Math.round(ms / DAY);
  return d === 1 ? 'a day' : d + ' days';
}
const soulsWord = n => n ? ' +' + n + (n === 1 ? ' soul.' : ' souls.') : '';

// Six stamps for the guestbook, drawn small and plain.
export const STAMP_SVG = {
  skull: '<path d="M12 3a7 7 0 0 0-7 7c0 2.6 1.3 4.4 3 5.4V19h8v-3.6c1.7-1 3-2.8 3-5.4a7 7 0 0 0-7-7Z" fill="currentColor" opacity=".25"/><path d="M12 3a7 7 0 0 0-7 7c0 2.6 1.3 4.4 3 5.4V19h8v-3.6c1.7-1 3-2.8 3-5.4a7 7 0 0 0-7-7Z"/><circle cx="9.3" cy="10.5" r="1.6" fill="currentColor"/><circle cx="14.7" cy="10.5" r="1.6" fill="currentColor"/><path d="M10.5 19v-2.5M13.5 19v-2.5"/>',
  candle: '<path d="M9 9h6v12H9Z" fill="currentColor" opacity=".25"/><path d="M9 9h6v12H9ZM7 21h10"/><path d="M12 3c2 2 2 4 0 5-2-1-2-3 0-5Z" fill="currentColor"/><path d="M15 12c-1 1-1 3 0 4"/>',
  moth: '<path d="M12 7v12"/><path d="M12 9C9 4 3 5 4 10c.6 3 4 4 8 2M12 9c3-5 9-4 8 1-.6 3-4 4-8 2M12 13c-3 0-6 2-5 5 2 1 4-1 5-3M12 13c3 0 6 2 5 5-2 1-4-1-5-3" fill="currentColor" fill-opacity=".25"/><path d="M11 6 9 3M13 6l2-3"/>',
  teeth: '<path d="M4 9c3-3 13-3 16 0v3c-3 3-13 3-16 0Z" fill="currentColor" opacity=".25"/><path d="M4 9c3-3 13-3 16 0v3c-3 3-13 3-16 0Z"/><path d="M8 8v6M12 7.5v7M16 8v6M4 11h16"/>',
  coffin: '<path d="M9 2h6l3 6-3 14H9L6 8Z" fill="currentColor" opacity=".25"/><path d="M9 2h6l3 6-3 14H9L6 8Z"/><path d="M12 7v7M9.5 9.5h5"/>',
  eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" fill="currentColor" opacity=".2"/><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>'
};
export const stampIcon = (id, label = '') => '<svg class="pb-stamp" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"' +
  (label ? ' role="img" aria-label="' + esc(label) + '"' : ' aria-hidden="true"') + '>' + (STAMP_SVG[id] || STAMP_SVG.skull) + '</svg>';
const glyph = id => '<span class="pb-glyph">' + curioSVG(id, { literal: true }) + '</span>';
export const waveText = w => fill((w.kind === 'poke' ? POKE_LINES : WAVE_LINES)[w.line % 8], { who: w.fromName || 'A friend', pet: w.residentName });
export const signatureLine = s => GUESTBOOK_LINES[s.line] || 'An entry this edition cannot read. It looks rude.';
const kind = (label, cls) => '<span class="pb-kind pb-kind-' + cls + '">' + label + '</span>';

/* ---- keeping the shelf in step with the postbox ---- */
function settle(ctx, box) {
  const changed = applyPostbox(ctx.state, box) | dropDepartedGuests(ctx.state);
  if (changed) { ctx.save(); window.dispatchEvent(new CustomEvent('shelflife:guests')); }
}
const loadBox = async ctx => {
  if (!ctx.postbox?.active()) return null;
  const box = await ctx.postbox.load();
  if (ctx.current && !ctx.current()) return null;
  settle(ctx, box);
  return box;
};
const counts = ctx => (ctx.postbox?.loaded() ? boxCounts(ctx.postbox.state()) : null);

/* ---------------- postbox sources ---------------- */

registerPostboxSource({
  id: 'visits', order: 30, label: 'Visits', poll: true,
  // Until this session has looked, the stored total stands for all of it.
  count: ctx => counts(ctx)?.visits ?? ctx.postbox?.count() ?? 0,
  async load(ctx) {
    const box = await loadBox(ctx);
    if (!box) return [];
    const now = Date.now();
    return [
      ...box.requests.map(r => ({ id: r.id, kind: 'request', at: r.createdAt, from: r.fromUser, fromName: r.fromName, unread: true, pets: { ['req-' + r.id]: r.resident },
        title: (r.fromName || 'A friend') + ' would like to send ' + r.resident.name + ' to stay',
        line: 'For ' + DAY_WORDS[r.days] + '. ' + r.resident.name + ' has already packed. The request lapses in ' + leftWords(r.expiresAt - now) + '.' })),
      ...box.endings.map(e => e.role === 'host'
        ? { id: e.id, kind: 'thanks', at: e.endedAt, from: e.otherUser, fromName: e.otherName, unread: true, title: e.residentName + ' has gone home', line: 'There is a note on the pillow.' }
        : { id: e.id, kind: 'postcard', at: e.endedAt, from: e.otherUser, fromName: e.otherName, unread: true,
            title: e.status === 'ended' ? 'A postcard from ' + (e.otherName || 'a friend') + '’s' : e.status === 'declined' ? (e.otherName || 'A friend') + ' said no' : 'Nobody answered the door',
            line: e.status === 'ended' ? e.residentName + ' is home, with a souvenir and a grievance.' : e.residentName + ' is back. It is fine. It is not fine.' })
    ];
  },
  render(item) {
    if (item.kind === 'request') {
      return '<div class="pb-with-art"><span class="pb-art" data-fr-pet="req-' + esc(item.id) + '"></span><div><p class="pb-title">' + kind('Visit', 'visit') + '<b>' + esc(item.title) + '</b></p><p class="pb-line">' + esc(item.line) + '</p></div></div>' +
        '<div class="pb-acts"><button class="btn btn-sm btn-primary" type="button" data-sx="accept" data-sx-id="' + esc(item.id) + '">Make up the spare shelf</button>' +
        '<button class="btn btn-sm" type="button" data-sx="decline" data-sx-id="' + esc(item.id) + '">Decline</button></div>';
    }
    return '<p class="pb-title">' + kind(item.kind === 'thanks' ? 'Thank you' : 'Postcard', 'visit') + '<b>' + esc(item.title) + '</b></p><p class="pb-line">' + esc(item.line) + '</p>' +
      '<div class="pb-acts"><button class="btn btn-sm btn-primary" type="button" data-sx="read" data-sx-id="' + esc(item.id) + '">' + (item.kind === 'thanks' ? 'Read the note' : 'Read the postcard') + '</button></div>';
  },
  async onClick(action, id, ctx) {
    if (action === 'accept' || action === 'decline') {
      await ctx.act(async current => {
        const r = await ctx.postbox.respondVisit(id, action === 'accept');
        if (!current()) return;
        settle(ctx, ctx.postbox.state());
        await ctx.reloadMail();
        const name = r.request?.resident.name || 'The guest', who = r.request?.fromName || 'your friend';
        ctx.say(r.status === 'accepted' ? name + ' has moved onto your shelf until ' + leftWords(r.request ? r.request.days * DAY : DAY) + ' from now. Feed it, fuss it, wash it. Nothing you do can hurt it, legally.'
          : 'Declined. ' + who + ' will be told, gently, by postcard.');
      });
      return;
    }
    if (action === 'read') {
      let shown = null;
      await ctx.act(async current => {
        const { ending, souls } = await ctx.postbox.collect(id);
        if (!current() || !ending) return;
        const kept = collectEnding(ctx.state, ending, souls);
        ctx.save(); ctx.renderAll();
        window.dispatchEvent(new CustomEvent('shelflife:guests'));
        shown = { ending, kept };
      });
      if (shown) showEnding(ctx, shown.ending, shown.kept);
    }
  }
});

registerPostboxSource({
  id: 'gifts', order: 40, label: 'Treats',
  count: ctx => counts(ctx)?.gifts ?? 0,
  async load(ctx) {
    const box = await loadBox(ctx);
    if (!box) return [];
    return box.gifts.map(g => {
      const treat = TREAT_BY_ID[g.treat];
      const name = treat?.name || 'Something unidentifiable';
      return { id: g.id, at: g.createdAt, from: g.fromUser, fromName: g.fromName, unread: g.status === 'sent', read: g.status !== 'sent', status: g.status, glyph: treat?.glyph || 'jar',
        title: (g.fromName || 'A friend') + ' sent you ' + name.replace(/^A /, 'a ').replace(/^The /, 'the ').replace(/^One /, 'one '),
        line: g.status === 'opened' ? 'Opened. ' + (treat?.line || 'Nobody knows what it was.') + (g.souls ? ' +' + g.souls + ' souls.' : ' Enjoyed for its own sake.')
          : g.status === 'declined' ? 'Declined. They are not told. They will suspect.'
          : (treat?.line || 'It is wrapped. It is breathing.') + ' Open it within a week or it goes off.' };
    });
  },
  render(item) {
    return '<div class="pb-with-art">' + glyph(item.glyph) + '<div><p class="pb-title">' + kind('Treat', 'treat') + '<b>' + esc(item.title) + '</b></p><p class="pb-line">' + esc(item.line) + '</p></div></div>' +
      (item.status === 'sent' ? '<div class="pb-acts"><button class="btn btn-sm btn-primary" type="button" data-sx="open" data-sx-id="' + esc(item.id) + '">Open it</button>' +
        '<button class="btn btn-sm" type="button" data-sx="decline" data-sx-id="' + esc(item.id) + '">Decline</button></div>' : '');
  },
  async onClick(action, id, ctx) {
    await ctx.act(async current => {
      if (action === 'open') {
        const gift = ctx.postbox.state().gifts.find(g => g.id === id);
        const r = await ctx.postbox.openGift(id);
        if (!current()) return;
        const paid = collectGift(ctx.state, id, r.souls);
        ctx.save(); ctx.renderAll();
        await ctx.reloadMail();
        const treat = TREAT_BY_ID[r.treat || gift?.treat];
        ctx.say('You open ' + (treat ? treat.name.replace(/^A /, 'a ').replace(/^The /, 'the ').replace(/^One /, 'one ') : 'it') + '. ' + (treat?.line || '') + (paid ? soulsWord(paid) : ' No souls today: five treats is the limit. It is still the thought.'));
      } else if (action === 'decline') {
        await ctx.postbox.declineGift(id);
        if (!current()) return;
        await ctx.reloadMail();
        ctx.say('Declined. It goes back unopened. Somebody somewhere feels a small chill.');
      }
    });
  }
});

registerPostboxSource({
  id: 'signatures', order: 50, label: 'Guestbook',
  count: ctx => counts(ctx)?.signatures ?? 0,
  async load(ctx) {
    const box = await loadBox(ctx);
    if (!box) return [];
    return box.signatures.map(s => ({ id: s.id, at: s.createdAt, from: s.signer, fromName: s.signerName, unread: !s.seen, read: s.seen, stamp: s.stamp,
      title: (s.signerName || 'A friend') + ' signed your guestbook', line: '“' + signatureLine(s) + '”' }));
  },
  render(item) {
    return '<div class="pb-with-art"><span class="pb-glyph pb-glyph-stamp">' + stampIcon(item.stamp, (STAMPS.find(s => s.id === item.stamp)?.name || '') + ' stamp') + '</span><div>' +
      '<p class="pb-title">' + kind('Guestbook', 'book') + '<b>' + esc(item.title) + '</b></p><p class="pb-line pb-hand">' + esc(item.line) + '</p></div></div>' +
      '<div class="pb-acts"><button class="btn btn-sm btn-ghost" type="button" data-sx="remove" data-sx-id="' + esc(item.id) + '">Tear out the page</button></div>';
  },
  async onClick(action, id, ctx) {
    if (action !== 'remove') return;
    await ctx.act(async current => {
      await ctx.postbox.removeSignature(id);
      if (!current()) return;
      book.entries = book.entries.filter(e => e.id !== id);
      await ctx.reloadMail();
      ctx.say('Torn out. The book is a page lighter and none the wiser.');
    });
  }
});

registerPostboxSource({
  id: 'waves', order: 60, label: 'Waves',
  count: ctx => counts(ctx)?.waves ?? 0,
  async load(ctx) {
    const box = await loadBox(ctx);
    if (!box) return [];
    return box.waves.map(w => ({ id: w.id, at: w.createdAt, from: w.fromUser, fromName: w.fromName, unread: !w.seen, read: w.seen, kind: w.kind,
      title: w.kind === 'poke' ? 'A poke' : 'A wave', line: waveText(w) }));
  },
  render(item) {
    return '<p class="pb-title">' + kind(item.kind === 'poke' ? 'Poke' : 'Wave', 'wave') + '<b class="sr-only">' + esc(item.title) + '</b></p><p class="pb-line">' + esc(item.line) + '</p>';
  },
  // Opening the postbox has read every wave and signature in it.
  seen: ctx => ctx.postbox?.loaded() ? ctx.postbox.seen() : null,
  clear: ctx => ctx.postbox?.clear()
});

/* ---------------- the end of a visit ---------------- */

function showEnding(ctx, ending, kept) {
  const back = 'postbox';
  if (ending.role === 'host') {
    ctx.show({ id: 'pb-note', back, title: 'A note on the pillow', kicker: ending.residentName + ' has gone home',
      html: '<article class="pb-note"><p class="pb-hand">' + esc(kept.text || '') + '</p>' + (kept.souls ? '<p class="pb-souls">' + esc(soulsWord(kept.souls).trim()) + ' For the hospitality.</p>' : '<p class="pb-souls">No souls today. Three visits a day pay; this one was for love.</p>') + '</article>',
      message: kept.souls ? 'A thank-you note and ' + kept.souls + ' souls.' : '' });
    return;
  }
  const card = kept.postcard, souvenir = kept.souvenir;
  ctx.show({ id: 'pb-postcard', back, title: ending.status === 'ended' ? 'A postcard home' : 'Back already', kicker: 'From ' + (ending.otherName || 'a friend') + '’s shelf',
    html: postcardMarkup(card, souvenir), message: kept.souls ? card.pet + ' is home. +' + kept.souls + ' souls.' : '' });
}
export function postcardMarkup(card, souvenir = souvenirInfo(card?.souvenir)) {
  if (!card) return '';
  return '<article class="pb-postcard"><div class="pb-postcard-face"><div class="pb-postcard-text"><p class="pb-hand">' + esc(card.text) + '</p>' +
    '<p class="pb-sign">Love, ' + esc(card.pet || 'your resident') + '</p></div><div class="pb-postcard-side"><span class="pb-postmark" aria-hidden="true">' + stampIcon('moth') + '</span>' +
    '<p class="pb-addr">The shelf<br>Home<br>(the good one)</p></div></div>' +
    (souvenir ? '<div class="pb-souvenir">' + glyph(souvenir.glyph) + '<div><span class="eyebrow">Souvenir</span><b>' + esc(souvenir.name) + '</b><p>' + esc(souvenir.line) + '</p></div></div>' : '') +
    (card.souls ? '<p class="pb-souls">+' + card.souls + ' souls, for the trouble.</p>' : '') + '</article>';
}

/* ---------------- friend actions ---------------- */

const offline = ctx => (ctx.online() ? '' : 'No connection. Try again once you are back online.');
registerFriendAction({
  id: 'visit-shelf', label: 'Visit their shelf', order: 10, primary: true,
  available: () => true,
  run(friend, ctx) { ctx.visitShelf(friend); }
});
registerFriendAction({
  id: 'invite', label: 'Send someone to stay', order: 20,
  available(friend, ctx) {
    if (!ctx.postbox) return false;
    const why = offline(ctx);
    if (why) return why;
    if (!ctx.state.pets.length) return 'You have nobody to send. Everyone is busy existing.';
    const there = ctx.postbox.state().away.find(a => a.toUser === friend.userId);
    if (there) return there.status === 'pending' ? there.residentName + ' is already waiting at their door.' : there.residentName + ' is staying with them for another ' + leftWords(there.leaves - Date.now()) + '.';
    return true;
  },
  run(friend, ctx) { showInvite(friend, ctx); }
});
registerFriendAction({
  id: 'treat', label: 'Send a treat', order: 40,
  available(friend, ctx) {
    if (!ctx.postbox) return false;
    return offline(ctx) || (ctx.postbox.state().giftedToday.includes(friend.userId) ? 'Treat sent today. Tomorrow, another.' : true);
  },
  run(friend, ctx) { showTreats(friend, ctx); }
});
registerFriendAction({
  id: 'sign', label: 'Sign their guestbook', order: 50,
  available(friend, ctx) {
    if (!ctx.postbox) return false;
    return offline(ctx) || (ctx.postbox.state().signedToday.includes(friend.userId) ? 'Signed today. Come back tomorrow with fresh opinions.' : true);
  },
  run(friend, ctx) { showSign(friend, ctx); }
});

/* ---- send someone to stay ---- */
function showInvite(friend, ctx, chosen = {}) {
  remember(friend);
  const away = new Set(ctx.postbox.state().away.map(a => a.residentId));
  const pets = ctx.state.pets.filter(p => !away.has(p.id));
  const pick = pets.some(p => p.id === chosen.pet) ? chosen.pet : pets[0]?.id;
  const days = [1, 2, 3].includes(chosen.days) ? chosen.days : 2;
  const who = friendName(friend);
  ctx.show({ id: 'pb-invite', back: 'friend:' + friend.userId, title: 'Send someone to stay', kicker: who + '’s spare shelf', friendId: friend.userId, focus: '#pbInviteFirst',
    pets: Object.fromEntries(pets.map(p => ['own-' + p.id, p])),
    html: '<form class="pb-form" data-fr-form="invite"><p class="pb-intro">A copy goes. The real one stays home and sulks. ' + esc(who) + ' answers within 48 hours, then looks after the guest: it cannot come to harm there, only to opinions.</p>' +
      '<fieldset class="pb-pick"><legend>Who goes</legend>' + (pets.length ? pets.map((p, i) => '<label class="pb-pet"><input type="radio" name="pbPet" value="' + esc(p.id) + '"' + (p.id === pick ? ' checked' : '') + (i ? '' : ' id="pbInviteFirst"') + '>' +
        '<span class="pb-art" data-fr-pet="own-' + esc(p.id) + '"></span><span>' + esc(p.name) + '</span></label>').join('') : '<p>Everyone is already away somewhere.</p>') + '</fieldset>' +
      '<fieldset class="pb-days"><legend>For how long</legend>' + VISIT_DAYS.map(d => '<label class="pb-choice"><input type="radio" name="pbDays" value="' + d.days + '"' + (d.days === days ? ' checked' : '') + '><span><b>' + esc(d.label) + '</b><small>' + esc(d.hint) + '</small></span></label>').join('') + '</fieldset>' +
      '<div class="fr-actions"><button class="btn btn-primary" type="submit"' + (pets.length ? '' : ' disabled') + '>Pack their bag</button></div></form>' });
}
registerSocialView('pb-invite', {
  async onSubmit(form, ctx) {
    const petId = form.querySelector('input[name="pbPet"]:checked')?.value, days = Number(form.querySelector('input[name="pbDays"]:checked')?.value);
    const pet = ctx.state.pets.find(p => p.id === petId), friend = ctx.friend(currentFriend);
    if (!pet || !friend || ![1, 2, 3].includes(days)) return;
    await ctx.act(async current => {
      await ctx.postbox.sendVisit({ to: friend.userId, pet, days });
      if (!current()) return;
      ctx.back();
      ctx.say(pet.name + ' has packed for ' + friendName(friend) + '’s. They have 48 hours to answer the door.');
    });
  }
});
// The friend the open form is about.
let currentFriend = '';
const remember = friend => { currentFriend = friend.userId; };

/* ---- a treat ---- */
function showTreats(friend, ctx) {
  remember(friend);
  const who = friendName(friend);
  ctx.show({ id: 'pb-treat', back: 'friend:' + friend.userId, title: 'Send a treat', kicker: 'For ' + who, focus: '#pbTreatFirst',
    html: '<form class="pb-form" data-fr-form="treat"><p class="pb-intro">One a day each. They open it for a few souls, or decline it and say nothing, which is worse.</p>' +
      '<fieldset class="pb-pick pb-treats"><legend>Which treat</legend>' + TREATS.map((t, i) => '<label class="pb-choice"><input type="radio" name="pbTreat" value="' + esc(t.id) + '"' + (i ? '' : ' checked id="pbTreatFirst"') + '>' +
        glyph(t.glyph) + '<span><b>' + esc(t.name) + '</b><small>' + esc(t.line) + '</small></span></label>').join('') + '</fieldset>' +
      '<div class="fr-actions"><button class="btn btn-primary" type="submit">Wrap it badly and send it</button></div></form>' });
}
registerSocialView('pb-treat', {
  async onSubmit(form, ctx) {
    const treat = TREAT_BY_ID[form.querySelector('input[name="pbTreat"]:checked')?.value], friend = ctx.friend(currentFriend);
    if (!treat || !friend) return;
    await ctx.act(async current => {
      await ctx.postbox.sendGift(friend.userId, treat.id);
      if (!current()) return;
      ctx.back();
      ctx.say(treat.name + ' is on its way to ' + friendName(friend) + '. It may arrive slightly different.');
    });
  }
});

/* ---- the guestbook ---- */
function showSign(friend, ctx) {
  remember(friend);
  const who = friendName(friend);
  ctx.show({ id: 'pb-sign', back: 'friend:' + friend.userId, title: 'Sign the guestbook', kicker: who + '’s guestbook', focus: '#pbLineFirst',
    html: '<form class="pb-form" data-fr-form="sign"><p class="pb-intro">Once a day. ' + esc(who) + ' can tear out any page they like, and probably will.</p>' +
      '<fieldset class="pb-stamps"><legend>A stamp</legend>' + STAMPS.map((s, i) => '<label class="pb-stamp-pick"><input type="radio" name="pbStamp" value="' + esc(s.id) + '"' + (i ? '' : ' checked') + '>' +
        stampIcon(s.id) + '<span>' + esc(s.name) + '</span></label>').join('') + '</fieldset>' +
      '<fieldset class="pb-pick pb-lines"><legend>What to write</legend>' + GUESTBOOK_LINES.map((line, i) => '<label class="pb-choice"><input type="radio" name="pbLine" value="' + i + '"' + (i ? '' : ' checked id="pbLineFirst"') + '>' +
        '<span class="pb-hand">' + esc(line) + '</span></label>').join('') + '</fieldset>' +
      '<div class="fr-actions"><button class="btn btn-primary" type="submit">Sign it</button></div></form>' });
}
registerSocialView('pb-sign', {
  async onSubmit(form, ctx) {
    const line = Number(form.querySelector('input[name="pbLine"]:checked')?.value), stamp = form.querySelector('input[name="pbStamp"]:checked')?.value, friend = ctx.friend(currentFriend);
    if (!friend || !Number.isInteger(line)) return;
    await ctx.act(async current => {
      await ctx.postbox.sign(friend.userId, line, stamp);
      if (!current()) return;
      theirBooks.delete(friend.userId);
      ctx.back();
      ctx.say('Signed. ' + friendName(friend) + ' will see it in their postbox, and judge your handwriting.');
    });
  }
});

/* ---------------- sections ---------------- */

// Who is staying here, and who of ours is away.
registerFriendsSection({
  id: 'pb-stays', where: 'home', order: 20,
  render(ctx) {
    const box = ctx.postbox?.state();
    if (!box || (!box.guests.length && !box.away.length)) return '';
    const now = Date.now();
    return '<h3>Comings and goings</h3><ul class="pb-stays">' +
      box.guests.map(g => '<li><b>' + esc(g.resident.name) + '</b> is staying with you, from ' + esc(g.fromName || 'a friend') + '’s, for another ' + esc(leftWords(g.leaves - now)) + '.</li>').join('') +
      box.away.map(a => '<li><b>' + esc(a.residentName) + '</b> ' + (a.status === 'pending' ? 'is waiting at ' + esc(a.toName || 'a friend') + '’s door.' : 'is away at ' + esc(a.toName || 'a friend') + '’s for another ' + esc(leftWords(a.leaves - now)) + '.') +
        (a.status === 'pending' ? ' <button class="btn btn-ghost btn-sm" type="button" data-sx="withdraw" data-sx-id="' + esc(a.id) + '">Call ' + esc(a.residentName) + ' back</button>' : '') + '</li>').join('') + '</ul>' +
      (box.guests.length ? '<p class="hint">Guests sit on the spare plank under your shelf. Tap one to look after it.</p>' : '');
  },
  async onClick(action, el, ctx) {
    if (action !== 'withdraw') return;
    await ctx.act(async current => {
      await ctx.postbox.withdrawVisit(el.dataset.sxId);
      if (!current()) return;
      ctx.say('Called back. The suitcase is unpacked with enormous, pointed sighs.');
    });
  }
});

// Your own guestbook: the newest pages, and all thirty on request.
const book = { user: null, entries: [], loading: false, loaded: false };
function loadBook(ctx) {
  const user = ctx.me.userId;
  if (!user || !ctx.postbox?.active()) return;
  if (book.user !== user) Object.assign(book, { user, entries: [], loading: false, loaded: false });
  if (book.loading || book.loaded) return;
  book.loading = true;
  ctx.postbox.guestbook(user).then(r => {
    if (book.user !== user) return;
    Object.assign(book, { entries: r.entries, loaded: true, loading: false });
    ctx.refresh();
  }, () => { book.loading = false; });
}
const entryMarkup = (e, remove = false) => '<li class="pb-entry">' + stampIcon(e.stamp) + '<div><p class="pb-hand">“' + esc(signatureLine(e)) + '”</p><small>' + esc((e.signerName || 'A friend') + ', ' + timeAgo(e.createdAt)) + '</small></div>' +
  (remove ? '<button class="btn btn-ghost btn-sm" type="button" data-sx="remove" data-sx-id="' + esc(e.id) + '">Tear out<span class="sr-only"> the page from ' + esc(e.signerName || 'a friend') + '</span></button>' : '') + '</li>';
registerFriendsSection({
  id: 'pb-book', where: 'home', order: 30,
  render(ctx) {
    if (!ctx.postbox) return '';
    loadBook(ctx);
    if (!book.entries.length && !ctx.friends().length) return '';
    const list = book.entries.slice(0, 3);
    return '<div class="pb-section-head"><h3>Your guestbook' + (book.entries.length ? ' <small>' + book.entries.length + '</small>' : '') + '</h3>' +
      (book.entries.length > 3 ? '<button class="btn btn-ghost btn-sm" type="button" data-sx="book">Read it all</button>' : '') + '</div>' +
      (list.length ? '<ul class="pb-entries">' + list.map(e => entryMarkup(e)).join('') + '</ul>' : '<p class="pb-empty">' + (book.loaded ? 'No signatures yet. Friends sign it from your shelf.' : 'Fetching the book.') + '</p>');
  },
  onClick(action, el, ctx) { if (action === 'book') showBook(ctx); }
});
function showBook(ctx) {
  ctx.show({ id: 'pb-book', back: 'main', title: 'Your guestbook', kicker: 'The newest thirty pages',
    html: book.entries.length ? '<ul class="pb-entries">' + book.entries.map(e => entryMarkup(e, true)).join('') + '</ul>' : '<p class="pb-empty">Empty. Nobody has written anything. Make of that what you will.</p>' });
}
registerSocialView('pb-book', {
  async onClick(action, el, ctx) {
    if (action !== 'remove') return;
    await ctx.act(async current => {
      await ctx.postbox.removeSignature(el.dataset.sxId);
      if (!current()) return;
      book.entries = book.entries.filter(e => e.id !== el.dataset.sxId);
      showBook(ctx);
      ctx.say('Torn out. The book is a page lighter and none the wiser.');
    });
  }
});

// Souvenirs and postcards brought home.
registerFriendsSection({
  id: 'pb-keepsakes', where: 'home', order: 40,
  render(ctx) {
    const v = ctx.state.friendVisits;
    if (!v?.souvenirs.length && !v?.postcards.length) return '';
    return '<div class="pb-section-head"><h3>Souvenirs <small>' + v.souvenirs.length + '</small></h3><button class="btn btn-ghost btn-sm" type="button" data-sx="postcards">Postcards (' + v.postcards.length + ')</button></div>' +
      '<ul class="pb-souvenirs">' + v.souvenirs.slice(0, 6).map(s => { const info = souvenirInfo(s.id); return info ? '<li title="' + esc(info.name) + '">' + glyph(info.glyph) + '<span>' + esc(info.name) + '</span></li>' : ''; }).join('') + '</ul>';
  },
  onClick(action, el, ctx) {
    if (action !== 'postcards') return;
    const cards = ctx.state.friendVisits.postcards;
    ctx.show({ id: 'pb-postcards', back: 'main', title: 'Postcards home', kicker: 'The newest twenty',
      html: cards.length ? cards.map(c => postcardMarkup(c)).join('') : '<p class="pb-empty">No postcards yet. Send someone to stay with a friend.</p>' });
  }
});

// On a friend's profile: what you have written in their book.
const theirBooks = new Map();
registerFriendsSection({
  id: 'pb-their-book', where: 'friend', order: 20,
  render(ctx, friend) {
    if (!ctx.postbox || !friend) return '';
    const known = theirBooks.get(friend.userId);
    if (!known) {
      theirBooks.set(friend.userId, { entries: [], loaded: false });
      ctx.postbox.guestbook(friend.userId).then(r => { theirBooks.set(friend.userId, { entries: r.entries, loaded: true }); ctx.refresh(); }, () => {});
    }
    const entries = known?.entries || [];
    return '<h3>Their guestbook</h3>' + (entries.length ? '<p class="hint">What you have written in it. They can see every page; you can see only yours.</p><ul class="pb-entries">' + entries.slice(0, 5).map(e => entryMarkup(e)).join('') + '</ul>'
      : '<p class="pb-empty">' + (known?.loaded ? 'You have never signed it. They have noticed.' : 'Opening the book.') + '</p>');
  }
});

export const _testing = { book, theirBooks, remember };
