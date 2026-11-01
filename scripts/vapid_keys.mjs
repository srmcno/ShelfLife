#!/usr/bin/env node
// Write a private JWK to a new local file with restrictive permissions.
import { writeFile } from 'node:fs/promises';
import { toBase64Url } from '../supabase/functions/push/crypto.mjs';
const filename = process.argv[2];
if (!filename) { console.error('Usage: node scripts/vapid_keys.mjs /secure/path/vapid-private.json'); process.exit(2); }
const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const privateJwk = await crypto.subtle.exportKey('jwk', keys.privateKey);
await writeFile(filename, JSON.stringify(privateJwk), { mode: 0o600, flag: 'wx' });
const publicKey = toBase64Url(await crypto.subtle.exportKey('raw', keys.publicKey));
console.log('Public VAPID key:', publicKey);
console.log('Private key written to', filename);
