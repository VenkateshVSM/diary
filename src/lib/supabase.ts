import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'chronicle_supabase_url';
const STORAGE_ANON_KEY = 'chronicle_supabase_anon_key';

/**
 * Generates a deterministic valid UUID from a Gmail address so that a user
 * always gets the exact same UUID for their Gmail ID even if "Confirm email"
 * is still pending in Supabase Auth.
 */
export function gmailToUuid(email: string): string {
  const clean = email.trim().toLowerCase();
  let h1 = 0xdeadbeef ^ clean.length;
  let h2 = 0x41c6ce57 ^ clean.length;
  let h3 = 0x1b873593 ^ clean.length;
  let h4 = 0x85ebca6b ^ clean.length;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);

  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const fullHex = hex(h1) + hex(h2) + hex(h3) + hex(h4);

  return `${fullHex.slice(0, 8)}-${fullHex.slice(8, 12)}-4${fullHex.slice(
    13,
    16
  )}-a${fullHex.slice(17, 20)}-${fullHex.slice(20, 32)}`;
}

export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  source: 'env' | 'local' | 'none';
} {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (envUrl && envKey && !envUrl.includes('your-project-id')) {
    return { url: envUrl, anonKey: envKey, isConfigured: true, source: 'env' };
  }

  const localUrl = (localStorage.getItem(STORAGE_URL_KEY) || '').trim();
  const localKey = (localStorage.getItem(STORAGE_ANON_KEY) || '').trim();

  if (localUrl && localKey) {
    return { url: localUrl, anonKey: localKey, isConfigured: true, source: 'local' };
  }

  return {
    url: envUrl || 'https://czcqmyrsbuyfhwpqlcau.supabase.co',
    anonKey: '',
    isConfigured: false,
    source: 'none',
  };
}

let supabaseInstance: SupabaseClient | null = null;
let currentClientKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return null;
  }

  const cacheKey = `${url}::${anonKey}`;
  if (!supabaseInstance || currentClientKey !== cacheKey) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      currentClientKey = cacheKey;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export function saveSupabaseConfigToLocal(url: string, anonKey: string): void {
  localStorage.setItem(STORAGE_URL_KEY, url.trim());
  localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
  supabaseInstance = null;
  currentClientKey = '';
}

export function clearLocalSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_URL_KEY);
  localStorage.removeItem(STORAGE_ANON_KEY);
  supabaseInstance = null;
  currentClientKey = '';
}

export const SUPABASE_SQL_SCHEMA = `-- Run this in your Supabase SQL Editor
create extension if not exists "uuid-ossp";

create table if not exists public.notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  user_email text not null,
  note_date date not null default current_date,
  title text not null default 'Untitled Note',
  content text not null default '',
  mood text not null default 'calm',
  tags text[] not null default '{}',
  is_pinned boolean not null default false,
  is_reviewed boolean not null default false,
  review_notes text not null default '',
  review_rating integer check (review_rating >= 1 and review_rating <= 5),
  review_count integer not null default 0,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If table was created earlier with a strict foreign key, drop it so unconfirmed Gmail logins also sync
alter table public.notes drop constraint if exists notes_user_id_fkey;

create index if not exists idx_notes_user_date on public.notes (user_id, note_date desc);
create index if not exists idx_notes_email_date on public.notes (user_email, note_date desc);
create index if not exists idx_notes_user_reviewed on public.notes (user_id, is_reviewed);

alter table public.notes enable row level security;

drop policy if exists "Users can view their own notes" on public.notes;
drop policy if exists "Users can insert their own notes" on public.notes;
drop policy if exists "Users can update their own notes" on public.notes;
drop policy if exists "Users can delete their own notes" on public.notes;
drop policy if exists "Allow Gmail workspace access" on public.notes;

create policy "Allow Gmail workspace access"
  on public.notes
  for all
  using (true)
  with check (true);
`;
