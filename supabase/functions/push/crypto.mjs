// RFC 8291 aes128gcm and RFC 8292 VAPID, using WebCrypto in Deno and Node.
const bytes = value => value instanceof Uint8Array ? value : new Uint8Array(value);
const text = value => new TextEncoder().encode(value);
const concat = (...parts) => { const size = parts.reduce((n, p) => n + p.length, 0); const result = new Uint8Array(size); let offset = 0; for (const p of parts) { result.set(p, offset); offset += p.length; } return result; };
export const fromBase64Url = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
export const toBase64Url = value => btoa(Array.from(bytes(value), n => String.fromCharCode(n)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hmac = async (key, data) => bytes(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), data));
const expand = async (key, info, length) => (await hmac(key, concat(info, new Uint8Array([1])))).slice(0, length);
const jwk = (publicKey, privateKey) => ({ kty: 'EC', crv: 'P-256', x: toBase64Url(publicKey.slice(1, 33)), y: toBase64Url(publicKey.slice(33, 65)), d: toBase64Url(privateKey), ext: true });

export async function encryptPush(message, subscription, options = {}) {
  const receiver = fromBase64Url(subscription.p256dh), auth = fromBase64Url(subscription.auth);
  if (receiver.length !== 65 || receiver[0] !== 4 || auth.length !== 16) throw new Error('Invalid subscription keys');
  const receiverKey = await crypto.subtle.importKey('raw', receiver, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  let keyPair;
  if (options.senderPrivate && options.senderPublic) {
    const pub = bytes(options.senderPublic), priv = bytes(options.senderPrivate);
    if (pub.length !== 65 || priv.length !== 32) throw new Error('Invalid sender key');
    keyPair = { publicKey: await crypto.subtle.importKey('raw', pub, { name: 'ECDH', namedCurve: 'P-256' }, true, []), privateKey: await crypto.subtle.importKey('jwk', jwk(pub, priv), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']) };
  } else keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const sender = bytes(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  const shared = bytes(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, keyPair.privateKey, 256));
  const salt = options.salt ? bytes(options.salt) : crypto.getRandomValues(new Uint8Array(16));
  if (salt.length !== 16) throw new Error('Invalid salt');
  const ikm = await expand(await hmac(auth, shared), concat(text('WebPush: info\0'), receiver, sender), 32);
  const prk = await hmac(salt, ikm);
  const cek = await expand(prk, text('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await expand(prk, text('Content-Encoding: nonce\0'), 12);
  const plain = concat(typeof message === 'string' ? text(message) : bytes(message), new Uint8Array([2]));
  if (plain.length + 16 > 4096) throw new Error('Push message too long');
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = bytes(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  return concat(salt, new Uint8Array([0, 0, 16, 0, sender.length]), sender, ciphertext);
}

export async function vapidAuthorization(endpoint, privateJwk, publicKey, subject, now = Date.now()) {
  const audience = new URL(endpoint).origin;
  if (!/^mailto:|^https:\/\//.test(subject)) throw new Error('Invalid VAPID subject');
  const header = toBase64Url(text(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = toBase64Url(text(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 60 * 60, sub: subject })));
  const signed = header + '.' + payload;
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = bytes(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text(signed)));
  if (signature.length !== 64) throw new Error('Unexpected ES256 signature');
  return 'vapid t=' + signed + '.' + toBase64Url(signature) + ', k=' + publicKey;
}
