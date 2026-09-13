# Hearings, expeditions and the filing desk

The September follow-up repairs whole journeys that were still hard to read or
easy to mistake for unfinished features. Play remains a static, offline-capable
game with the existing saved residents and six-column shelf.

## Shelf Court

The current witness and paired evidence are the main decision surface. A short
brief states the crime and the objective; clue tabs expose the evidence, and a
resident roster makes calling another suspect visible. The deduction grid is an
optional notebook that remains open while its cells are used. Guidance is derived
from the player's recorded inspections and rulings, not the hidden answer.

Verdicts show the defendant's plea, Mortis's sentence, the actual care/trust
receipt, and why the evidence fits. Existing seeded v2 and v3 hearings retain their
move replay rules. Rulings and witness changes trigger short, distinct reactions;
merely opening the notebook does not repeatedly slam the gavel.

## Expeditions

One presentation boundary (`expeditionView` / `mountExpedition`) renders planning,
encounters, field reports and homecoming. Crew and packed equipment appear in
authored drawer, fridge and cupboard sets. Route markers distinguish visited
stops, recovered parts and parts already owned. A saved journey retains its log.

Available choices display exact next resources from the engine's existing
`trailMove` calculation. Rest restores nerve; detours spend it; only a matching
tool recovers a mission part. Two distinct parts build a permanent workshop
project, including parts collected on different trips. Returning early preserves
visited rewards and never claims unvisited stops or their full-route field note.
Legacy two-choice outings remain playable. Rewards are issued by the engine once,
before the result screen, so reopening a report cannot pay again.

## Paperwork and empty areas

Paperwork used to be a filter over forty transient notes. Its source was a random
document/list draw with additional care and narrative gates. Ordinary chatter or
Clear notes could remove every matching entry, while completed Court and outing
results were tagged as general scheme notes. Nothing explained this distinction.

`paperwork-state.js` now holds an independent archive of the latest 120 documents.
Document and list notes are filed when created. Recorded Court, expedition, market
and visitor outcomes are filed through `recordScene`. Loading an older save
recovers its surviving documents and supported outcome scenes exactly once; it
does not invent historical events that the save no longer contains.

The player can file a household register based on actual residents, shelf seats,
care counts, trust and completed activities. An unchanged register is not filed
twice and grants no reward. Archive records survive clearing the board, reloads
and normal backup/restore. Older documents fold for mobile reading. Storage failure
feedback distinguishes a record kept for the current visit from one saved to disk.

Note filters show counts and explain what generates their contents. A quiet
complaint filter is a valid state. Incidents explains its milestone purpose and
names unfinished goals. An empty display distinguishes unowned keepsakes from
owned keepsakes awaiting placement. A scene history explains which activities
create its first memory.

## Motion and verification

Auto effects uses Light on touch devices. Light previously suppressed gameplay
puppet gestures and whole scene timelines, making the phone version appear much
less alive. Light now simplifies decoration while retaining finite action
feedback. Reduced motion still disables travel/gesture animations; hidden tabs,
closed scenes and interrupted scenes stop owned work. Controlled game portraits
are reserved from the shelf's random idle director.

Run `npm test`, `python3 -m unittest discover -s test -p '*_test.py'`,
`npm run build`, and `npm run test:browser`. Browser scenarios exercise complete
hearings and trips, incorrect deductions, save/resume, single rewards, legacy
hearings, report persistence and save failure at desktop, touch and WebKit phone
sizes. Release identity is recorded in `release.json`; the service-worker cache
and deployed revision must agree.

The Pages deployment now runs `scripts/verify_pages.mjs` against the public URL in
fresh desktop and touch Chromium contexts. It checks the exact revision, adopts a
resident, saves a Court clue and expedition choice, files and reloads a real
household register, earns a real rug catch, then reloads offline with the saved
household and installed room artwork. The workflow retains screenshots and logs.
