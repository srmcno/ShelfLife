# Co-op souls and household copies

Co-op uses one durable receipt ledger per signed-in account. The shelf remains a local save, and cloud save retains one household copy per account. Multiple devices using that household share the account ledger; signing another account into the same local shelf does not create a shared wallet between accounts.

Before the first wager, the client saves an opening snapshot with its owner and receipt cursor. The server accepts that opening once. Subsequent ordinary game earnings and purchases are separate saved operations, rather than another opening balance.

A device whose local household has no matching opening cannot adopt an existing account's server balance or declare a second grant. Co-op offers **Open cloud save**. The existing cloud dialog lets the player choose between **Keep this device** and **Use the cloud copy**, retaining the other shelf as a safety copy for one week. Using the matching cloud household restores its opening, cursor and pending operations. Keeping an unrelated local household preserves normal offline gameplay, but Co-op still needs the account's matching cloud household. A copy choice never counts as game income.

## Saving and retrying

The central save boundary records genuine wallet and lifetime-earned changes in a journal. Each operation has a stable UUID, account owner, signed wallet delta and independently recorded earned amount. For example, earning100 and spending100 before one save produces delta0, earned100. Wallet, journal and checkpoint are persisted in one save. Failed persistent storage blocks opening or transmitting financial operations; retry retains the same IDs.

The adjustment contract is `coop_adjust(p_ops)` with at most100 `{id, delta, earned, detail?}` operations. The owner comes from authentication. The server stores an immutable `game` receipt with `source_id=id`; repeating that payload is harmless, while changing an existing operation is refused. Receipt pages expose `has_more` and `last_seq` and must be contiguous for their owner.

A matching pending operation already changed the local purse, so its server receipt only acknowledges it. An older backup without that pending operation applies the receipt once. Opening snapshots, pending operations, owner cursors and semantic reward histories are financial bookkeeping and are never pruned as recent activity.

Offline purchases can overtake a stake placed on another device. The local purse stays nonnegative and carries any unpaid debit as debt. Later receipts repay debt before giving spendable souls. The server may have a negative budget from genuine offline purchases; a new stake must still be fully funded. A missing debit is never erased merely because the restored local purse is empty.

## Rewards and restored state

Backend-idempotent rewards need more than an anonymous wallet delta. Their operation UUID derives from the owner and semantic source key using SHA-256 UUIDv8. The receipt also includes validated metadata that restores the paid marker and actual cosmetic award. This prevents restoring an old backup, replaying its currency receipt and collecting the same chest again.

Reward handlers rebuild markers and non-currency effects only; the receipt engine owns the money. When an operation remains pending locally, both its cash and effects are already applied and must not be applied again. Pending metadata survives normalization before its feature controller loads.

Replacing/importing a household rebases the currency checkpoint without interpreting the imported balance as an earning. Reconciliation and gameplay callbacks also capture the Co-op state object's identity, so an in-place restore under the same account cancels old work. Account changes prevent submitting or applying another owner's operations.

Unowned v1 prototype holds, attempts and reward marks are retained in quarantine. No account is guessed from whichever player happens to sign in. Co-op was not released with those prototype records; production rollout requires schema/data preflight rather than silently assigning them.

## Verification checkpoint

The client journal, real cloud-copy decision engine and receipt replay are covered by unit tests. Browser journeys use explicitly labelled in-memory Supabase fixtures and real player controls. The original four Co-op journeys passed across Chromium desktop, Chromium mobile and WebKit mobile before this journal extension. The new adjustment endpoint, reward metadata and new-device browser journey still require alignment and verification against the final server migration; none of these results proves a live deployment.
