import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptPush, fromBase64Url, toBase64Url, vapidAuthorization } from '../supabase/functions/push/crypto.mjs';

test('RFC 8291 section 5 and appendix A encryption vector', async () => {
  const body = await encryptPush('When I grow up, I want to be a watermelon', {
    p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg'
  }, {
    senderPrivate: fromBase64Url('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'),
    senderPublic: fromBase64Url('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'),
    salt: fromBase64Url('DGv6ra1nlYgDCS1FRnbzlw')
  });
  assert.equal(toBase64Url(body), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});

test('VAPID signs a bounded token for the push service origin', async () => {
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const privateJwk = await crypto.subtle.exportKey('jwk', keys.privateKey);
  const publicKey = toBase64Url(await crypto.subtle.exportKey('raw', keys.publicKey));
  const auth = await vapidAuthorization('https://fcm.googleapis.com/path', privateJwk, publicKey, 'mailto:owner@example.com', 1_700_000_000_000);
  const token = auth.match(/^vapid t=([^,]+), k=/)[1];
  const [head, payload, signature] = token.split('.');
  assert.deepEqual(JSON.parse(new TextDecoder().decode(fromBase64Url(payload))), { aud: 'https://fcm.googleapis.com', exp: 1_700_043_200, sub: 'mailto:owner@example.com' });
  assert.equal(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keys.publicKey, fromBase64Url(signature), new TextEncoder().encode(head + '.' + payload)), true);
});
