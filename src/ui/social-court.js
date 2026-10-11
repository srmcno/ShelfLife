// Shelf Court in the Friends hub, through the same plug points as everything
// else: papers served on you and verdicts on papers you served are postbox
// sources, and Serve papers is a friend action.
//
// The 30 second mail check (src/cloud/inbox.js) already asks for the Court's
// inbox, so neither source polls. Verdicts are paid when the postbox (or the
// Friends sheet) is opened, never in the background.
import { registerPostboxSource, registerFriendAction } from './social-registry.js';
import { collectVerdicts, verdictLine, esc } from './friends.js';
import { COURT_BY_ID } from '../engine/court.js';

// Verdicts already read this session stay in the postbox, marked read, until Clear read.
let kept = { user: null, list: [] };
const keptFor = user => { if (kept.user !== user) kept = { user, list: [] }; return kept.list; };

function courtState(ctx) {
  const st = ctx.social.inboxState();
  return { st, fresh: st.cases.length + st.results.length > 0 };
}

registerPostboxSource({
  id: 'summons', order: 10, label: 'Papers served',
  // Until this session has read the inbox, the stored count stands for all of it.
  count(ctx) { const { st, fresh } = courtState(ctx); return fresh ? st.cases.length : ctx.social.inboxCount(); },
  async load(ctx) {
    if (!ctx.social.active()) return [];
    const box = await ctx.social.inbox();
    return box.cases.map(c => {
      const title = COURT_BY_ID[c.caseId]?.title || 'a case this edition does not know';
      const sentence = c.side === 'd' ? c.plaintiff.name + ', from ' + (c.fromName || 'a friend') + ', is defending against your ' + c.defendant.name + ' over ' + title + '.'
        : c.plaintiff.name + ', from ' + (c.fromName || 'a friend') + ', is suing ' + c.defendant.name + ' over ' + title + '.';
      return { id: c.id, at: c.createdAt, from: c.fromUser, fromName: c.fromName, unread: true, title: 'You’ve been served', line: sentence };
    });
  },
  render(item) {
    return '<p class="pb-title"><span class="pb-kind pb-kind-court">Papers</span><b>' + esc(item.title) + '</b></p><p class="pb-line">' + esc(item.line) + '</p>' +
      '<div class="pb-acts"><button class="btn btn-sm btn-primary" type="button" data-sx="court" data-sx-id="' + esc(item.id) + '">Open Shelf Court</button>' +
      '<button class="btn btn-sm" type="button" data-sx="decline" data-sx-id="' + esc(item.id) + '">Decline</button></div>';
  },
  async onClick(action, id, ctx) {
    if (action === 'court') { ctx.close(); window.dispatchEvent(new CustomEvent('shelflife:court')); return; }
    if (action === 'decline') await ctx.act(async current => {
      await ctx.social.decline(id);
      if (!current()) return;
      await ctx.reloadMail();
      ctx.say('Declined. The papers have been returned, slightly crumpled.');
    });
  }
});

registerPostboxSource({
  id: 'verdicts', order: 20, label: 'Verdicts',
  count(ctx) { return courtState(ctx).st.results.length; },
  async load(ctx) {
    if (!ctx.social.active()) return [];
    const user = ctx.me.userId;
    const box = await ctx.social.inbox();
    // An answer for an account that has since signed out must not be paid here.
    if (!ctx.current() || user !== ctx.me.userId) return [];
    const list = keptFor(user);
    const fresh = collectVerdicts(ctx.state, ctx.social, box.results).filter(v => !list.some(x => x.id === v.id));
    list.unshift(...fresh);
    if (fresh.some(v => v.souls)) ctx.renderAll();
    return list.map(v => ({ id: v.id, at: v.ruledAt, from: v.toUser, fromName: v.toName, read: true, title: 'A verdict', line: verdictLine(v) }));
  },
  render(item) {
    return '<p class="pb-title"><span class="pb-kind pb-kind-court">Verdict</span><b>' + esc(item.title) + '</b></p><p class="pb-line">' + esc(item.line) + '</p>';
  },
  async clear(ctx) { keptFor(ctx.me.userId).length = 0; }
});

registerFriendAction({
  id: 'serve', label: 'Serve papers', order: 30,
  available(friend, ctx) {
    if (!ctx.online()) return 'No connection. Papers need a postman.';
    if (!ctx.state.pets.length) return 'You need a resident to do the suing.';
    return true;
  },
  run(friend, ctx) { ctx.visitShelf(friend, { serve: true }); }
});

