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
      { title: 'The Almanac', text: 'A chapter a month, each with thirty tiers of prizes for things you were doing anyway. Miss one and its curios turn up later in Back Issues, at a markup the Collector calls “sentimental”.' },
      { title: 'The Thin Season', text: 'From 15 October to 2 November some coffins hold one of six seasonal curios. They stay in the cabinet afterwards. Nobody asked them to.' },
      { title: 'Shelf Court reruns', text: 'Cases now have twisted versions, so memorising last week’s verdict will get you booed. You also get one Objection an episode, and a ten-rank bench career that starts at Courtroom Sweeper.' },
      { title: 'A first day with directions', text: 'New households get a six-step tour and one card saying what to do next. Help → Glossary explains every number on the screen, including the ones you were pretending to understand.' },
      { title: 'Calm mode', text: 'More → Calm mode stops everything moving. The residents still judge you. They just do it without blinking, which is worse.' },
      { title: 'Report a problem', text: 'More → Report a problem sends a note to the people responsible, with the details that help them fix it. You see every word before it goes. Blame is not attached.' }
      // Integrator: append this release’s social features here (the Postbox,
      // trades, joint Court and the rest), one { title, text } each, in the
      // same voice. Keep the list short: six to eight items in all.
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
