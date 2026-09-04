# SHELF LIFE — COMEDY DIRECTION & IMPLEMENTATION SPEC

*Grounded against the actual repo: `src/state.js` (`addNote(state,text,from,kind)`, notes capped at 40), `src/content/copy.js` (298 strings, median ~53 chars), `src/engine/behavior.js` (`fill()` with `{p}{n}{m}{q}`), `src/content/traits.js` (65 archetypes with `notes[]`/`social[]`), `css/style.css:210` (`.note` — 20px handwriting, 28px line-height, `minmax(224px,1fr)` grid, **no `white-space` rule**), `src/ui/render.js:157` (`innerHTML` after `escapeHtml`).*

---

## 0. THE ONE-SENTENCE DIAGNOSIS

The current writing is not unfunny because the jokes are bad. It is unfunny because **every note is one creature performing at you, alone, in the same meter, ending on a withheld fact.** Three of those four things have to change, and the fourth (the withhold) has to be rationed to roughly one note in ten so it becomes a punch again instead of a tic.

The four levers, in order of size:

1. **Put a second creature in the room.** The funniest half of a line is almost never the pet with the grievance — it's the neighbour who is bored of it. This single change does more than any register swap.
2. **Make the physical facts load-bearing.** These things are four inches tall, wrong-textured, on a numbered grid, and cannot die. Almost no current line would break if they were adults in a flatshare. Every line should break.
3. **Interpolate real state.** The game knows you fed Gary first eleven times. It has never once said so.
4. **Rotate the form.** A dialogue, a list and a one-liner are three different objects on a corkboard. Forty one-liners are one object.

---

## 1. THE VOICE

**"Flat reportage of small wrong permanent things, in an ensemble."**

The camera is a dry, unbothered observer on the shelf itself — clipped, British, present-perfect, never editorialising, never announcing that a joke has happened. It reports what the creatures did and, wherever possible, reports what a *second* creature did about it. The comedy comes from three sources and no others: **precision** (an exact figure, an exact time, an exact slot), **physical wrongness** (scale, texture, damp, the fact that nothing here can end), and **a straight man** (another pet, visibly tired of this).

The creatures are not witty. They are *committed*. They are small, they have infinite time, and they take a grievance about a bowl with exactly the seriousness a person would take a mortgage dispute. The narrator finds none of this remarkable. Warmth is allowed and required — but warmth arrives as physical fact ("has not let go") rather than as sentiment, and it is usually slightly too much.

Register rules the writer must feel in the hand: **the sentence stops one beat before you want it to.** If the line explains what it means, the last clause is deletable, and you should delete it. If a line could be spoken by a human flatmate with nothing lost, it is not yet a Shelf Life line — put the four inches back in.

**Exemplars:**

> Everything on the shelf is one inch to the left this morning. Including the shelf.

> {a}: I could go another day.
> {b}: You're four inches tall.
> {a}: I could go another day.

> Went to bite {b}. Got tired halfway. Is now resting against {b} with its mouth open.

---

## 2. FORM ROTATION

Eight forms. Percentages are of total note volume. The engine must tag each note with its form and **must not fire the same form twice in a row**, and no form other than #1 twice within four notes.

| # | Form | Share | Shape | Best for |
|---|---|---|---|---|
| 1 | **Flat one-liner** (1–2 sentences, ≤90 chars) | **40%** | Report. Stop. | Everyday need decay, ambient ticks, trait notes, care responses. This is the load-bearing everyday supply and it must stay short. |
| 2 | **Two-hander** (2–4 alternating lines, `{a}:` / `{b}:`) | **18%** | The complainer speaks; the neighbour is bored. Funny half is always the second speaker. | Hunger, feuds, care responses, returns, arrivals. **Requires ≥2 pets.** |
| 3 | **Reaction shot** (a third pet's response *is* the note) | **8%** | Someone did a thing; the note is about who watched. | Feuds, accusations, overnight, rehoming. |
| 4 | **List / manifest** (3–5 short items, one wrong) | **10%** | Mundane, mundane, mundane, wrong. Never label it as a joke. | Overnight events, arrivals, inventories, absence reports. |
| 5 | **Found object / physical fact** (no speaker at all) | **9%** | The shelf has changed. Here is the measurement. | Overnight, grudge escalation, rehoming aftermath, props. |
| 6 | **Filled-in document** (MINUTES / ROTA / RECORD — 4–8 short lines) | **6%** | Bureaucracy applied to a crumb. **Max one per "Check the shelf" batch.** | Feud escalation, Item 4 payoffs, absence, grudge stage 3. |
| 7 | **Direct address** (second person, the creature turns round) | **6%** | Rare and therefore devastating. Never two in a session. | Grudge stage 3, arrivals, high bond, rehoming questions. |
| 8 | **Silence / negative space** (an absence reported flatly) | **3%** | A thing that used to happen has stopped. | Post-payoff states, closed grudges, rehomed slots. |

**Length budget (enforced in test):** 60% of all strings ≤ 90 chars; 30% ≤ 160; 10% ≤ 280. Nothing above 280, ever. Current median is 53 — forms 1/2/3 must keep that median roughly intact or the corkboard becomes homework, which is the failure that killed four of the nine pitches.

**Required render changes** (these are prerequisites, not polish):

```css
.note{ white-space:pre-line; }                   /* forms 2, 4, 6 collapse without this */
.note--doc{ font-family:var(--body); font-size:14px; line-height:1.45;
            letter-spacing:.01em; }              /* typed forms read as typed */
@media (min-width:720px){ .note--doc{ grid-column:span 2; } }
```

```js
// state.js
export function addNote(state, text, from, kind = 'note', form = 'line') {
  const n = { text, from, kind, form, at: Date.now() };
  ...
}
// render.js: d.className = 'note ' + n.kind + (n.form === 'doc' ? ' note--doc' : '');
```

---

## 3. STATE-AWARE LINES

### 3a. State the game must start keeping

All cheap, all additive, all defaulted in `normalizeState()`:

```js
pet.careLog   = { food:0, fuss:0, clean:0 };      // per-need counts
pet.firstTouch= 0;                                 // sessions where this pet was touched first
pet.names     = [{ name, at }];                    // rename history, push on rename
pet.bestFuss  = 0;                                 // longest consecutive fuss run
pet.slotHist  = [{ slot, at }];                    // last 8 placements (drag + autonomy)

state.gone    = [{ name, id, slot, at, neighbors:[names] }];  // NEVER pruned
state.visits  = [{ at, dur, firstTouch }];         // last 20 sessions
state.ledger  = { meeting:1, carried:0, struck:{} };
```

Derived at note time: `hoursAway`, `state.streak.count`, `state.pets.length`, `neighborPets(state, slot)`, `feudArcs[key].level`, `sum(pet.grudges)`.

### 3b. Extend `fill()`

```js
const SUBS = { p:pet, n:neighbor, m:other, q:propKind,
  a:feudA, b:feudB, c:between,        // the pet physically between a and b
  h:hoursAway, d:streakDays, g:pet.grudges, G:totalGrudges,
  fav:mostCaredPet, favN:count, selfN:thisPetCount, tot:visits.length,
  old:previousName, days:daysUnderOldName,
  gone:goneName, goneD:daysSince, slot:slotIndex,
  best:pet.bestFuss, mtg:state.ledger.meeting, carr:state.ledger.carried,
  clock:lastFedTimeString, nP:state.pets.length };
```

Every pool declares its required subs; a content test fails the build if a template references a sub its slot cannot supply. **Never interpolate a number the save file cannot back** — invented precision ("400 units of dust", "1,204 times") teaches the player to stop reading the real numbers, which are the whole asset.

### 3c. The templates (ship all of these)

**Favouritism** — needs `careLog`, `firstTouch`
- `{p} has the feeding order. Of your last {tot} visits you went to {fav} first {favN} of them.`
- `{p} has drawn a chart of it. The chart is on the back of last week's chart, in a steadier hand.`
- `{p} worked this out with {b}, over several evenings. They have a chart.` *(reaction shot)*
- `CARE RECORD — {p}\nFed: {food}\nFussed: {fuss}\nCleaned: {clean}\nFirst: 0` *(doc)*

**Absence** — needs `hoursAway`
- `Nobody counted the {h} hours. There is a tally under the shelf. Nobody counted.`
- `{a}: They're back. / {b}: Don't start. / {a}: I've not started. / {b}: You've been starting for {h} hours.`
- `In your absence a rota was drawn up covering your jobs. It has been worked for {h} hours without complaint.`
- `{n} spent {h} hours telling the others you'd be back. {n} has raised this four times since you got here.`

**Streak** — needs `streak.count`
- `You have opened this {d} days running. {p} has been fussed on none of them.`
- `Day {d}. Attendance kept in a book. The book has two columns and you are in the shorter one.`

**Rename** — needs `pet.names`
- `{p} answered to {old} for {days} days. It answered to {p} within the hour.`
- `{b} still uses {old} when you're out of the room. {p} still turns round.`

**Rehoming** — needs `state.gone` (this is the highest-value hook in the game and currently unused)
- `{a} mentioned {gone} once, on Tuesday. Everyone watched what you did with your face.`
- `Slot {slot} has been empty {goneD} days. The dust in that square is deeper than anywhere else.`
- `{p} would like to ask you about {gone}. Not tonight.` *(direct address, rare)*
- `The register still lists {gone}. Nobody here can strike a name.` *(found object)*

**Adjacency / the grid** — needs `slots`, `neighborPets`
- `{a} and {b} have divided the shelf. The line runs through {c}.`
- `{a} moved one inch toward {b} at 3am and has not moved since. {b} has been awake for all of it.`
- `{p} has chosen the worst slot on the shelf. Four better ones were free.`
- `You moved {p} from slot {i} to slot {j}. {p} has written a seating clause and dated it before.`

**Grudges** — needs `grudges`, `grudgeStage`
- `{p} has forgiven you {g} times since Tuesday, out loud, at even intervals.`
- `{p} has stopped keeping score. It went over it {g} times tonight.`

**Bond / warmth** — needs `bond`, `bestFuss`
- `Let you fuss it for eleven seconds. The record is {best}.`
- `Fell asleep mid-fuss holding your finger. Has not let go. It has been forty minutes.`

---

## 4. BUILDING / CALLBACKS

Four mechanisms. All four are cheap. The first is the spine.

### 4a. THE MINUTE BOOK (primary — the "you are Item 4" engine)

`state.ledger = { meeting, carried, struck }`.

- Every feud escalation, grudge increment, or overnight event increments `ledger.meeting`.
- Any pet may file MINUTES (form 6). Items 1–3 are shelf trivia drawn from real state (the bowl, the slot, the sentence). **Item 4 is always you.** Item 4 is always carried forward, and the note prints `carried forward {carr} times`.
- The number is `pet.grudges` and `feudArcs.level` wearing a costume — the player has been watching it climb without knowing it was a countdown.
- **Payoff, at `grudgeStage === 3`:** Item 4 is moved, seconded, and struck from all future agendas. The outcome is not disclosed. `ledger.struck[petId] = Date.now()`.
- **The real payoff is what happens next:** that pet is permanently barred from forms 6 and 7. Its notes go to form 1 and form 8 only, short and polite, and it never references the matter again. *Absence is the joke.* This is the single strongest structural idea across all nine approaches and it costs one boolean.

### 4b. THE BRIEFING (arrival callback)

The first note from any pet created while `totalGrudges > 12`:

> `{p}: Hello. I've been briefed. You're at {G}.`

One integer, zero new state, pays off weeks of accumulation, and is delivered by a creature that wasn't there for any of it. Ship this on day one.

### 4c. THE VACANCY (rehoming is permanent)

`state.gone[]` is never pruned. A rehomed pet keeps generating notes forever — from the empty slot, from the neighbours who remember, from the register. `card.js` already tells the player "It does not come back." The writing has never once agreed with it. Fire a `{gone}` line roughly once every 15 notes for the first week after a rehoming, then once every 60 forever.

### 4d. THE RECORD (small, warm, beatable)

`pet.bestFuss` — the longest run of consecutive fusses. It is quoted flatly ("Permitted eleven seconds. The record is fourteen."), it can be **beaten**, and when it's beaten the note says so without ceremony. This is the counterweight: a number that goes the *right* way, so the shelf isn't a one-valence slope. Every register that scored badly above failed because it could not be fond of the player. This is how you buy that back for nothing.

---

## 5. RULES OF THUMB

### A line is good here when:
1. **A second creature is in it**, and the second creature is unimpressed.
2. **It could not be said about a human.** Scale, texture, dampness, the grid, or the fact that nothing here dies is doing work.
3. **It carries a number the save file can prove**, and that number is the accusation.
4. **It stops one beat early.** Delete the last clause; if it got better, that was the right cut.
5. **It's under 90 characters** unless it's earning its length as a document.
6. **It could only be said by *this* pet** — a line that survives reassignment to any other pet is a line with no character in it. Trait `notes[]`/`social[]` pools must keep their own voices; the primary register belongs to the shelf-level and player-facing slots.

### KILL LIST (a content test should grep for these)

1. **The withheld ending.** "Would not say what." / "Nobody will say who." / "It will not say which." / "You have not been told the outcome." Cap: **one note in ten, maximum**. This is the disease. Every one of the nine approaches re-imported it in a new costume, and every judge caught it.
2. **The explanatory final clause.** Anything opening `which`, `and that is`, `because`, `so that`, `what makes it`. "…which everyone has correctly understood to mean…" is the writer taking a bow. Ban `which` in final position outright.
3. **The gloss.** "That is the part it wants you to sit with." / "Nothing further will need to be said." / "It says that warmly." If the note tells the reader how to feel, cut the sentence.
4. **Costume monotony.** No ALL-CAPS header more than once per batch. No two documents in a row. Corporate idiom capped at **one per line, four per hundred lines** — its vocabulary is forty words deep and it drains in a week.
5. **Fake precision.** No number that isn't read from state. Decorative figures poison the real ones.
6. **Swappable comedy.** If the line works with the monsters replaced by staplers, flatmates, or office workers, it fails rule A2. Roughly half of every losing approach failed here.
7. **Menace mistaken for comedy.** Jars with your name on, hair in a box, a lid, "a shoebox with your name on it." Ominous is easy and it is not funny; it also crosses from *cute-but-wrong* into *planning your murder*, which is a narrower and meaner game. Cap the genuinely sinister at ~1 in 25 and never in the care slots.
8. **Cold care.** The CARE and HAPPY pools are the highest-frequency notes in the game. If feeding produces a snub every time, the player stops reading by week two. **At least a third of care responses must be uncomplicatedly fond** — physically fond, not sentimentally.
9. **The tricolon that says one thing three times.** "did not agree to this, was not consulted, and cannot get out of the middle of it."
10. **Cast-dependent writing with no fallback.** Forms 2, 3 and most of 6 need ≥2 named pets. A first-hour, one-pet shelf must have a full-strength pool of forms 1, 4, 5 — that is exactly when the player decides whether this game is funny.

---

## 6. GOLD-STANDARD SAMPLE (25 lines)

*Calibration reference for rewriting all content. Form tag in brackets. 16 of 25 are under 100 characters; 11 interpolate real state; 12 are impossible without a small immortal thing on a grid; 2 end on a withhold.*

**1. FURIOUS-HUNGRY**
1. `{a}: I could go another day.` / `{b}: You're four inches tall.` / `{a}: I could go another day.` — *[two-hander]*
2. Went to bite {b}. Got tired halfway. Is now resting against {b} with its mouth open. — *[line]*
3. Ate four inches of shelf and is currently standing on the part it ate. — *[line]*
4. Bowl empty since {clock}. It has drawn a bowl and licked the drawing. — *[line]*

**2. FEUD ESCALATION**
5. {a} and {b} have divided the shelf. The line runs through {c}. — *[line]*
6. {a} apologised. {b} accepted, warmly, and wrote down the date. — *[line]*
7. `MINUTES OF THE SHELF — ITEM 3` / `{a} says it said "after you."` / `{b} says it heard "if you must."` / `Neither will repeat it.` / `Carried forward {carr} times.` — *[doc]*
8. {a} moved one inch toward {b} at 3am and has not moved since. {b} has been awake for all of it. — *[found object]*

**3. OVERNIGHT EVENT**
9. Everything on the shelf is one inch to the left this morning. Including the shelf. — *[found object]*
10. A rota went up overnight. Monday to Sunday, and an eighth column headed AFTER. — *[found object]*
11. The shelf was counted twice last night by two different counters. The totals agree. The totals are {nP}. — *[line — nP renders as pets.length + 1]*
12. `FOUND THIS MORNING, IN A ROW, SORTED BY SIZE:` / `a button` / `a tooth` / `a smaller tooth` / `a key that fits nothing here` / `a second key` — *[list]*

**4. GRUDGE STAGE 3**
13. {p} cannot lift a kettle. {p} is four inches tall. There is a cup of tea beside you, at the right temperature, made how you take it, and you have never told anybody how you take it. — *[found object]*
14. `ITEM 4 — ANY OTHER BUSINESS` / `Carried forward from meetings 1 to {mtg}.` / `Moved that the matter be closed. Seconded.` / `Item 4 has been struck from all future agendas.` — *[doc, fires once per pet]*
15. {p} has stopped filing. It says good morning now, at the same time each morning, to the second. — *[silence]*
16. {p} has forgiven you {g} times since Tuesday, out loud, at even intervals. — *[line]*

**5. RETURNING PLAYER**
17. `{a}: They're back.` / `{b}: Don't start.` / `{a}: I've not started.` / `{b}: You've been starting for {h} hours.` — *[two-hander]*
18. Nobody counted the {h} hours. There is a tally under the shelf. Nobody counted. — *[line]*
19. In your absence a rota was drawn up covering your jobs. It has been worked for {h} hours without complaint. — *[found object]*

**6. CARE RESPONSE**
20. `{p}: I didn't ask for it.` / `{b}: You've been asking since Tuesday.` / `{p}: Mentioning isn't asking.` / `It ate the whole thing during that.` — *[two-hander]*
21. Permitted eleven seconds of that. The record is {best}, set on a Thursday. — *[line]*
22. Fell asleep mid-fuss holding your finger. Has not let go. It has been forty minutes. — *[line]*
23. Was cleaned. Has walked past {b} four times, slowly, saying nothing. — *[reaction shot]*

**7. ARRIVAL**
24. {p} arrived and was given the tour by {b}. Nine minutes, almost entirely about {m}, who was not on the tour. — *[line]*
25. `{p}: Hello. I've been briefed. You're at {G}.` — *[direct address — the Briefing payoff]*

**8. PLAYER-SPECIFIC ACCUSATION** *(these three replace three of the above in rotation — the slot is too important to leave at zero)*
- {p} has the feeding order. Of your last {tot} visits you went to {fav} first {favN} times. The chart is on the back of last week's chart, in a steadier hand. — *[found object]*
- {p} answered to {old} for {days} days and to {p} within the hour. {b} still uses {old} when you're out of the room, and {p} still turns round. — *[line]*
- {a} mentioned {gone} once, on Tuesday. Everyone watched what you did with your face. — *[reaction shot]*

---

## 7. SHIPPING ORDER

1. **Render prerequisites** — `white-space:pre-line`, `.note--doc`, `form` param on `addNote`. Without these, forms 2/4/6 render as run-on mush.
2. **State additions** + extended `fill()` + content test asserting every template's subs are supplied by its slot.
3. **Rewrite forms 1–3 first** (66% of volume, no new persistence needed beyond `careLog`/`hoursAway`). This alone answers the owner's complaint.
4. **`state.gone` + rename history** — unlocks the eight best player-accusation lines in this document.
5. **The Minute Book + the Briefing + the Record.** Ledger, one integer; briefing, one string; record, one comparison.
6. **Audit the 298 existing strings against the kill list.** Expect to cut or repair roughly a third — every line whose second sentence withholds, and every line that would survive being said about a stapler.