import { encryptPush, vapidAuthorization, toBase64Url } from './crypto.mjs';
import { deliverBatches } from './delivery.mjs';

// Only the database's pg_net request can invoke this function. The secret and
// service-role token stay in the function environment and are never logged.
const url = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const secret = Deno.env.get('PUSH_SECRET') || '';
const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const subject = Deno.env.get('VAPID_SUBJECT') || '';
const jwkText = Deno.env.get('VAPID_PRIVATE_JWK') || '';
const encoder = new TextEncoder();
type Subscription = { endpoint: string; p256dh: string; auth: string; count: number };
type Batch = { user_id: string; lease: string; subscriptions: Subscription[] };
type DeliveryResult = { p_lease: string; p_user: string; p_ok: boolean; p_dead: string[]; p_sent: string[] };

function sameSecret(a: string, b: string) {
  const left = encoder.encode(a), right = encoder.encode(b);
  if (!left.length || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
function allowed(endpoint: string) {
  try {
    const u = new URL(endpoint), host = u.hostname;
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.hash &&
      (host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' || host === 'web.push.apple.com' ||
       host.endsWith('.push.apple.com') || host.endsWith('.notify.windows.com'));
  } catch { return false; }
}
async function rpc(name: string, body: object) {
  const response = await fetch(url + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: serviceKey, authorization: 'Bearer ' + serviceKey, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Push queue RPC failed: ' + response.status);
  return response.json();
}

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!sameSecret(request.headers.get('x-push-secret') || '', secret)) return new Response('Unauthorized', { status: 401 });
  if (!url || !serviceKey || !publicKey || !subject || !jwkText) return new Response('Push is not configured', { status: 503 });
  let privateKey: JsonWebKey;
  try { privateKey = JSON.parse(jwkText); } catch { return new Response('Push is not configured', { status: 503 }); }
  try {
    const batches = await rpc('push_take', {});
    await deliverBatches(batches, async (batch: Batch, subscription: Subscription) => {
      if (!allowed(subscription.endpoint)) return 'dead';
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(batch.user_id)));
      const topic = toBase64Url(digest).slice(0, 32);
      const count = Number(subscription.count);
      const body = JSON.stringify({ title: 'Shelf Life', body: count === 1 ? 'Something arrived in your postbox.' : `${count} things arrived in your postbox.`, url: '?open=postbox' });
      const ciphertext = await encryptPush(body, subscription);
      const authorization = await vapidAuthorization(subscription.endpoint, privateKey, publicKey, subject);
      const response = await fetch(subscription.endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(6000), headers: { Authorization: authorization, TTL: '86400', Topic: topic, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' }, body: ciphertext });
      if (response.status === 404 || response.status === 410) return 'dead';
      return response.ok ? 'sent' : 'retry';
    }, (result: DeliveryResult) => rpc('push_result', result));
    // If more ready work remains, enqueue one further bounded invocation.
    await rpc('push_wake', {});
    return Response.json({ ok: true });
  } catch {
    return new Response('Push delivery failed', { status: 503 });
  }
});
