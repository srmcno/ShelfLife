// The one place the game's version lives.
//
//   VERSION  what More shows, what feedback reports carry, and the Android
//            app's versionName (android/app/build.gradle reads this file; its
//            versionCode is major * 10000 + minor * 100 + patch). Bump it
//            before every Play upload: Play refuses a versionCode it has seen.
//            package.json carries the same string (a test keeps them equal).
//   BUILD    the day this version was cut, as YYYY-MM-DD.
//   COMMIT   empty in the repository; scripts/build_site.py writes the short
//            commit into the packaged copy, so a report says exactly which
//            build sent it.
//   CHANGES  release notes, newest first. The "What's new" sheet shows the
//            entries newer than the version a household last saw. Each item
//            is one short title and one or two sentences in the game's voice.
// No DOM and no imports: safe to load anywhere, including Node.

export const VERSION = '1.1.0';
export const BUILD = '2026-10-11';
export const COMMIT = '';

export const CHANGES = [
  {
    version: '1.1.0',
    date: '2026-10-11',
    items: [
      { title: 'The Almanac and Thin Season', text: 'A chapter a month, with thirty tiers of prizes. Missed curios turn up in Back Issues. From 15 October to 2 November, coffins can also hold seasonal curios that stay in the cabinet afterwards.' },
      { title: 'Directions and Calm mode', text: 'New households get a six-step tour and one card saying what to do next. Help → Glossary explains the numbers; More → Calm mode reduces background movement.' },
      { title: 'The Postbox', text: 'Visit friends, invite their residents to stay, send treats, wave and sign guestbooks. Residents come home with postcards and souvenirs. The postbox keeps the replies together.' },
      { title: 'Trades', text: 'Give or swap spare curios and residents with friends, with counter-offers and a final confirmation. Packed residents stay on the shelf until the trade is sealed.' },
      { title: 'The Joint Bench', text: 'Serve papers for a friend to judge. Both rulings stay sealed until the second judge finishes, then the Bench reveals whether you agreed. Ordinary Court also has reruns, an Objection and a bench career.' },
      { title: 'Covens and Mischief', text: 'Start or join a coven for shared weekly goals and a notice board. Friends can also send hexes, offer care help and visit seasonal trick-or-treat doors.' },
      { title: 'Company for expeditions', text: 'Hire a friend’s resident, challenge them to an arcade duel, or introduce residents to raise foundlings and start pen-pal letters.' },
      { title: 'Help improve Shelf Life', text: 'Review a problem report before sending it, or queue it offline. More controls play-day counting. Tester tools mark the save so test scores stay out of competition.' }
    ]
  }
];

// [major, minor, patch] from "1.2.3"; anything unreadable is [0, 0, 0].
export function versionParts(value) {
  const m = String(value ?? '').match(/^(\d{1,3})\.(\d{1,2})\.(\d{1,2})$/);
  return m ? m.slice(1).map(Number) : [0, 0, 0];
}

// Negative when a is older than b, positive when newer, 0 when equal.
export function compareVersions(a, b) {
  const x = versionParts(a), y = versionParts(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// The Android versionCode for a version, as android/app/build.gradle works it out.
export function versionCode(value = VERSION) {
  const [major, minor, patch] = versionParts(value);
  return major * 10000 + minor * 100 + patch;
}

// "Shelf Life 1.1.0 · build 2026-10-11", with the commit when the build has one.
export function versionLine({ version = VERSION, build = BUILD, commit = COMMIT } = {}) {
  return 'Shelf Life ' + version + ' · build ' + build + (commit ? ' (' + commit + ')' : '');
}

// Release notes newer than `seen` and no newer than `current`, newest first.
// A household several versions behind sees at most the last two releases.
export function changesSince(seen, { current = VERSION, changes = CHANGES, limit = 2 } = {}) {
  return changes
    .filter(release => compareVersions(release.version, current) <= 0 && (!seen || compareVersions(release.version, seen) > 0))
    .slice(0, limit);
}
