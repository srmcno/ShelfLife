// Optional cloud save. With both values empty the game never shows an account,
// never loads a session and never makes a network request.
//
// Both values come from the Supabase dashboard: Project Settings > API (the
// Project URL and the publishable key). The publishable key is public by design
// and safe to commit: row level security in supabase/migrations is what
// protects each player's save, not the secrecy of this key. Never put a secret
// or service_role key here.
export const CLOUD_CONFIG = {
  url: 'https://wsddmmsddghqxymwsgwt.supabase.co',
  anonKey: 'sb_publishable_Ow2VUbObAS3RKnbxLY0Bkw_VtUFIj1N'
};

// Browser tests inject a fake server through SHELFLIFE_CLOUD_CONFIG.
export function cloudConfig() {
  const injected = globalThis.SHELFLIFE_CLOUD_CONFIG;
  return injected && typeof injected === 'object' ? injected : CLOUD_CONFIG;
}

export function cloudConfigured(config = cloudConfig()) {
  return !!(config && typeof config.url === 'string' && /^https?:\/\/\S+$/.test(config.url.trim()) &&
    typeof config.anonKey === 'string' && config.anonKey.trim());
}
