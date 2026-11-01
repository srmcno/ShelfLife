// Four claimed queue rows and at most five subscriptions per user bound work.
// A failed subscription is reported for retry without resending prior successes.
export async function deliverBatches(batches, send, report, { now = Date.now, deadline = now() + 40000, minimumBudget = 7000 } = {}) {
  if (!Array.isArray(batches) || batches.length > 4) throw new Error('Invalid push batch');
  await Promise.all(batches.map(async batch => {
    if (!Array.isArray(batch.subscriptions) || batch.subscriptions.length > 5) throw new Error('Invalid subscriptions');
    let ok = true;
    const dead = [], sent = [];
    for (const subscription of batch.subscriptions) {
      if (deadline - now() < minimumBudget) { ok = false; break; }
      try {
        const result = await send(batch, subscription);
        if (result === 'sent') sent.push(subscription.endpoint);
        else if (result === 'dead') dead.push(subscription.endpoint);
        else ok = false;
      } catch { ok = false; }
    }
    await report({ p_lease: batch.lease, p_user: batch.user_id, p_ok: ok, p_dead: dead, p_sent: sent });
  }));
}
