# Synthetic preservation checkpoint

`reviewed-revision-synthetic.json.gz` contains nine synthetic households, never player data. It was generated from a clean `git archive` of reviewed production `e77b69bf0736d616ada031806742ca7f82e6e80c` using that revision's `test/household-fixtures.mjs`: fresh, established, nearly-full, drawing-heavy, conflicting traits, sleeping, capped, legacy, and an interrupted expedition made through `startOuting` and one `chooseOuting` command.

For each snapshot, normalization under the reviewed source and repaired source was compared for resident IDs/names/art/traits/name and position history, slots, furniture, notes, scenes, installed projects, collected parts and active outing. All nine comparisons matched. This is migration evidence, not a user-play result or a claim that every historic save was tested. Existing repository tests cover restored transaction prefixes and one-time reward receipts.
