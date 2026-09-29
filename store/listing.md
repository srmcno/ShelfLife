# Google Play listing: draft

Everything the Play Console asks for, in the order it asks. Paste, then check each line against the build
you are actually uploading. Cloud save and the friend features that depend on it appear only when
`src/cloud/config.js` names a Supabase project; several answers below change with that, and say how.

Assets in this folder: `play-icon-512.png` (app icon), `feature-graphic.jpg` (1024 x 500) and
`screenshots/` (eight 1080 x 1920 phone screenshots from `node scripts/store_screenshots.mjs`).

## Store listing

**App name** (30 max): Shelf Life

**Short description** (80 max, this one is 78):

> Small immortal creatures, daily disasters and a cabinet of cursed curiosities.

**Full description** (4000 max, this one is about 2,400):

```text
Small creatures. Long memories. Immortal. Unwashed. In arrears.

Shelf Life is a darkly comic creature game. Make peculiar little residents, look after them, and deal with whatever they have done this time.

SOMETHING HAS GONE WRONG
Every twelve minutes something goes wrong on the shelf. Somebody finds the rat poison, starts a cult or holds a funeral for a raisin. Each emergency is a card with two choices and a result that is usually regrettable. Who is involved changes the odds, and a plain risk read tells you exactly how ill-advised you are being.

SOULS, COFFINS AND CURSED CURIOS
Every outcome pays souls. Souls buy coffins, and every coffin holds a cursed curio for the Cabinet of Curiosities: 34 of them, from Common to Unholy. Turn over tonight's omen, finish three unholy chores a day, and watch the neighbours' opinion of your house get steadily worse.

MAKE SOMEONE PECULIAR
Grow a creature part by part, or draw one by hand and give it eyes that blink and legs that sneak. Name it. Move it in. Feed it, fuss over it and wash it: care builds trust, and trust unlocks furniture. Where everyone sits matters. Some neighbours feud.

THE PLAYROOM
Shelf Court is a daytime small-claims TV show, filmed live on your shelf. You are Judge Mortis, a skeleton in a powdered wig. Two residents sue each other over something petty, the rest of the shelf sits on the jury, and a ghost studio audience reacts to everything. Eighteen hand-written cases, and one of the three verdicts is always the truth.

Four quick arcade games too: Feeding Frenzy, Coffin Stack, The Séance and Grave Whack. And expeditions that bring home parts for household projects.

COMING BACK TOMORROW
A daily arcade challenge, a Shelf Court case on the docket every day and a season that returns each autumn. A missed night is forgiven once. Nothing is ever taken away.

STORIES AND KEEPSAKES
Little adventures, subplots between residents, a note board full of complaints and a museum of everything that has happened. The residents remember how you treat them.

NO FUSS
Free. No ads and no in-app purchases. No account needed. Your household lives on your phone and plays offline. Optional nudges say when the next emergency is due, and stay quiet overnight. A narrator can read the notes aloud in the driest voice your phone has.

They get hungry, bored and filthy in real time. Nobody here stays buried. You can take a break.
```

If cloud save is switched on for the release, add this paragraph before the last line:

```text
Cloud save and friends are there if you want them. Your shelf can follow you to another phone or a browser, signed in with a code sent to your email. Swap friend codes to show each other your shelves, summon each other's residents to Shelf Court and compare daily scores. Friends only: no chat, no strangers.
```

**App category:** Game, **Casual**. (Simulation also fits; Casual is where short daily sessions are
browsed.)

**Tags** (up to five, from Play's list): Virtual pet, Casual, Offline, Single player, Cartoon.

**Contact details:** Play shows a developer email on the listing and requires one. Use an address made for
the purpose, entered in the Play Console only; it must not go in this repository. Website:
`https://srmcno.github.io/ShelfLife/`.

**Privacy policy URL:** `https://srmcno.github.io/ShelfLife/privacy.html`

## App content declarations

| Question | Answer |
| --- | --- |
| Privacy policy | `https://srmcno.github.io/ShelfLife/privacy.html` |
| Ads | No, the app contains no ads |
| App access | All functionality is available without special access. Cloud save is optional and signs in with an emailed code; reviewers do not need it |
| Content rating | See below |
| Target audience | 13 to 15, 16 to 17, 18 and over. Not under 13 |
| Appeals to children | No: dry, darkly comic writing about curses, funerals and paperwork |
| News app | No |
| COVID-19, health, financial features, government app | No |
| Data safety | See below |
| In-app purchases | None |

## Content rating questionnaire (IARC)

Category: **Game**. Answer from what is in the build:

- **Violence:** cartoon or fantasy only. Stylised creatures in peril (rat poison, a thrown tooth, hands
  climbing out of graves being pushed back down). Nobody is hurt on screen, nothing bleeds, and no
  resident ever dies. No realistic violence, no weapons aimed at people.
- **Fear:** mild. Skeletons, ghosts, coffins, séances and curses, all played for laughs.
- **Blood and gore:** none.
- **Sexuality, nudity:** none.
- **Language:** none. The worst of it is a judge calling both parties idiots.
- **Controlled substances:** none. Rat poison appears as a hazard, not a drug.
- **Crude humour:** mild, if the form asks: death and curse jokes, funerals for raisins.
- **Gambling:** no real-money gambling and no simulated casino games. Coffins and the nightly omen give
  random in-game rewards, bought only with souls earned in play; nothing can be bought with money.
- **Users interact or share content:** there is no public chat and no public profile. Without cloud save
  configured, answer **No**. With it, answer that users can share limited content with friends they have
  accepted: a display name, a shelf on show (which can include hand-drawn creatures), Court summonses and
  daily scores, with no free-form messaging. Strangers see only anonymous score numbers. Players can
  remove and block a friend and report abuse; reports are kept for moderation, so somebody has to read
  them (in the Supabase table editor, `public.reports`).
- **Shares location:** no. **Digital purchases:** no.

Expect roughly PEGI 7 / ESRB Everyone 10+ for fantasy peril and mild fear. The target audience stays 13+
whatever the rating says.

## Data safety form

Mapped from `privacy.html`. Everything below is collected **only when the player turns on cloud save**,
so each type is marked **optional**. Supabase is a service provider processing data on our behalf, and
things a player shows to accepted friends are user-initiated, so none of it counts as **shared** in Play's
sense.

| Section | Answer |
| --- | --- |
| Does the app collect or share any of the required user data types? | Yes (collected, optionally) |
| Is all user data encrypted in transit? | Yes (HTTPS to Supabase) |
| Do you provide a way for users to request that their data is deleted? | Yes: in the app (More → Cloud save → Delete) and at `https://srmcno.github.io/ShelfLife/delete-account.html` |

| Data type (Play's name) | What it is here | Collected | Shared | Optional | Purpose |
| --- | --- | --- | --- | --- | --- |
| Personal info: Email address | Only if the player adds one, for the sign-in code | Yes | No | Yes | Account management |
| Personal info: Name | The display name the player chooses, shown to accepted friends | Yes | No | Yes | App functionality |
| Personal info: User IDs | The account id and friend code | Yes | No | Yes | Account management, App functionality |
| App activity: Other user-generated content | The cloud save: residents, drawings, names, notes; the shelf on show to friends; the reason typed into a report | Yes | No | Yes | App functionality, Fraud prevention, security and compliance (reports) |
| App activity: Other actions | Game progress in the save, friend requests and blocks, Court summonses, daily arcade scores | Yes | No | Yes | App functionality |
| Device or other IDs | The random device id the game makes up, such as `android-k2x9q4mz` | Yes | No | Yes | App functionality |

Not collected: location, financial info, health, messages, photos and videos, audio, files, calendar,
contacts, web browsing, app info and performance (no crash reporting or analytics), and device info
beyond the made-up id. Nudges are local notifications with no server. Data is not processed
ephemerally; it is kept until the account is deleted.

If the release goes out without cloud save configured, the game makes no network requests at all and the
answer to the first question is **No**.

## Release checklist

1. **Before the first upload.** Bump `version` in `package.json`. Make the upload key and
   `android/keystore.properties` (README, "Signing a release"). Run `npm test`, the browser suite and
   `npm run android:bundle`. Try the app on a real phone: Back on every sheet and on the shelf, Back up,
   Move to another device, Restore from a file in Downloads, postcard save and share, the narrator, turning
   nudges on (Android 13 and later ask for permission), the status and gesture bars in portrait and
   landscape, and airplane mode.
2. **Create the app** in the Play Console as a free game, and accept Play App Signing.
3. **Fill in App content** from the tables above, the store listing, and the assets in this folder.
4. **Internal testing.** Upload the signed AAB to the internal track and install it from Play on your own
   devices. Read the **pre-launch report** (Play's robot run on real devices): crashes, accessibility
   warnings and screenshots at odd sizes.
5. **Closed testing.** New personal developer accounts must run a closed test with **at least 12 testers
   opted in for 14 consecutive days** before production access can be requested. Invite them by email
   list or Google Group, ask them to keep the app installed and play most days, and keep a note of what
   they report. Upload fixes to the same track with a higher `version`.
6. **Apply for production** once the 14 days are up, answering Play's questions about the test.
7. **Staged rollout.** Release to a small share first (for example 10%), watch Android vitals (ANRs,
   crashes) and reviews for a few days, then 50%, then everyone. A staged rollout can be halted if
   something is wrong.
8. **Every later release.** Bump `version`, rebuild, upload, and update the Data safety form and content
   rating if a feature changes what is collected or shared (the friend features do).
