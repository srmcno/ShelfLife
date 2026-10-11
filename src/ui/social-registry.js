// Plug points for the social features, so each one lives in its own module and
// the Friends sheet (ui/friends.js) only has to ask what is registered.
//
// A feature module registers itself when it is imported (main.js imports it)
// and never edits friends.js. Everything here is plain data and functions; a
// broken registrant must never break the sheet, so every call is guarded.
//
// The `ctx` object the Friends sheet passes to every callback:
//   {
//     state,                   the live game state
//     social, cloud,           the clients from src/cloud/
//     me: { userId, code, name },
//     friends(),               accepted friends: [{ userId, name, code, ... }]
//     friend(userId),          one of them, or null
//     show(view),              render a custom view inside the sheet:
//                                { id, kicker, title, html, back = 'main' | 'friend:<userId>' | 'postbox' }
//                              clicks inside it on [data-sx] reach the owner's onClick
//     back(),                  return to where the view said it came from
//     refresh(),               repaint the sheet (and the tray badge)
//     say(text),               the sheet's polite status line
//     toast(text),             a game toast
//     save(),                  persist the game state
//     renderAll(),             repaint the whole game (after state changes)
//     postbox,                 the postbox client (src/cloud/postbox.js)
//     act(work, focus?),       run async work with the sheet busy and errors on the status line;
//                              work(current) gets current() -> false once the account has changed
//     current(),               false once the account has changed since this ctx was made
//     openFriend(userId),      openPostbox(), close(), visitShelf(friend, { serve })
//     online(),                false when the device says it is offline
//     level(userId),           { name, line, total, next, progress } from the friendship counts
//   }
// The Friends sheet renders friend actions as [data-fr-action="<id>"] buttons and
// sections inside [data-fr-section="<id>"], so specs can find them.

const actions = [];
const sources = [];
const sections = [];
const views = new Map();

const guard = (fn, fallback) => { try { return fn(); } catch (error) { console.error('[social]', error); return fallback; } };
const byOrder = (a, b) => (a.order ?? 50) - (b.order ?? 50);
const replace = (list, item) => { const i = list.findIndex(x => x.id === item.id); if (i >= 0) list.splice(i, 1, item); else list.push(item); list.sort(byOrder); };

/* An action on a friend's profile ("Serve papers", "Invite to visit", "Propose a trade").
   { id, label, order, icon?,
     available(friend, ctx) -> true | false | 'reason it is unavailable',
     run(friend, ctx) }                       usually calls ctx.show(...) */
export function registerFriendAction(action) {
  if (!action?.id || typeof action.run !== 'function') return;
  replace(actions, action);
}
export function friendActions(friend, ctx) {
  return actions.map(a => ({ ...a, state: guard(() => (a.available ? a.available(friend, ctx) : true), false) }))
    .filter(a => a.state !== false);
}

/* A kind of mail in the postbox (summonses, visit requests, trade offers, gifts, verdicts).
   { id, order, label,
     count(ctx) -> number                     how many need the player (drives the badge), synchronous, from cache
     load(ctx) -> Promise<item[]>             fetch fresh; items are { id, at (ms), title, line, html?,
                                              from?: userId (adds Block and Report to the row),
                                              unread?: true (counts for the friend's dot), read?: true (Clear read) }
     render(item, ctx) -> html               one row; buttons carry data-sx="<action>" data-sx-id="<item.id>"
     onClick(action, itemId, ctx) -> Promise  handle a button in a row
     poll?: true                              include in the 30 second inbox check
     seen?(ctx) -> Promise                    the player has looked at the postbox
     clear?(ctx) -> Promise                   "Clear read": drop the items marked read } */
export function registerPostboxSource(source) {
  if (!source?.id || typeof source.load !== 'function') return;
  replace(sources, source);
}
export function postboxSources() { return sources.slice(); }
export function postboxCount(ctx) {
  return sources.reduce((n, s) => n + (Number(guard(() => (s.count ? s.count(ctx) : 0), 0)) || 0), 0);
}

/* A section on the Friends home view or a friend's profile.
   { id, order, where: 'home' | 'friend',
     render(ctx, friend?) -> html            '' to show nothing
     onClick?(action, el, ctx, friend?) } */
export function registerFriendsSection(section) {
  if (!section?.id || typeof section.render !== 'function') return;
  replace(sections, section);
}
export function friendsSections(where) { return sections.filter(s => (s.where || 'home') === where); }

/* The owner of a custom view (ctx.show({ id })) hears clicks on [data-sx] inside it.
   registerSocialView(id, { onClick(action, el, ctx), onSubmit?(form, ctx) }) */
export function registerSocialView(id, handlers) { if (id && handlers) views.set(id, handlers); }
export function socialView(id) { return views.get(id) || null; }

export function renderSafely(fn, fallback = '') { return guard(fn, fallback); }

// The Friends sheet's ctx, for things outside the sheet (the 30 second mail
// check, the badge). null until the sheet has been built.
let context = null;
export function setSocialContext(ctx) { context = ctx || null; }
export function socialContext() { return context; }

// For tests.
export function resetSocialRegistry() { actions.length = 0; sources.length = 0; sections.length = 0; views.clear(); context = null; }
