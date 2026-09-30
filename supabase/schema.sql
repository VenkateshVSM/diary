-- =============================================================================
-- CHRONICLE: Date-Based Note & Review Application — Supabase Database Schema
-- Run this script in your Supabase Dashboard -> SQL Editor
-- =============================================================================

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

-- Drop strict auth.users foreign key if present so Gmail accounts can save notes immediately
-- even before clicking the email confirmation link
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
