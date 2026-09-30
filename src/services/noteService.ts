import { format, subDays } from 'date-fns';
import { getSupabaseClient } from '../lib/supabase';
import { CreateNoteInput, Note, UpdateNoteInput } from '../types/note';

const LOCAL_NOTES_KEY_PREFIX = 'chronicle_notes_';

function getLocalNotesKey(userId: string): string {
  return `${LOCAL_NOTES_KEY_PREFIX}${userId}`;
}

export function getSeedNotes(userId: string, userEmail: string): Note[] {
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const threeDaysAgo = format(subDays(new Date(), 3), 'yyyy-MM-dd');
  const fiveDaysAgo = format(subDays(new Date(), 5), 'yyyy-MM-dd');
  const nowIso = new Date().toISOString();

  return [
    {
      id: 'seed-note-1',
      user_id: userId,
      user_email: userEmail,
      note_date: today,
      title: 'Product Architecture & Daily Priorities',
      content: `## Morning Focus\nToday's primary objective is refining our **date-based journaling workflow** and ensuring every note is effortlessly reviewable over time.\n\n### Action Checklist\n- [x] Finalize Supabase database schema with Row Level Security\n- [x] Connect Gmail authentication flow\n- [ ] Review last week's architecture takeaways in the Review Deck\n\n> "Clarity comes from writing down what matters today and reviewing it with fresh eyes tomorrow."`,
      mood: 'productive',
      tags: ['architecture', 'planning', 'focus'],
      is_pinned: true,
      is_reviewed: false,
      review_notes: '',
      review_rating: null,
      review_count: 0,
      last_reviewed_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'seed-note-2',
      user_id: userId,
      user_email: userEmail,
      note_date: yesterday,
      title: 'Evening Reflection: Deep Work & Energy Management',
      content: `## What Went Well\nBlocking out 3 uninterrupted hours in the morning made a dramatic difference in output quality.\n\n### Key Observations\n- Context switching between notifications reduced deep thinking.\n- Taking a 15-minute walk before afternoon reviews reset mental fatigue.\n\n### Tomorrow's Intention\nKeep phone in another room until the first major milestone is shipped.`,
      mood: 'reflective',
      tags: ['reflection', 'habits', 'deep-work'],
      is_pinned: false,
      is_reviewed: true,
      review_notes: 'Confirmed: keeping mornings notification-free boosted velocity by ~40%. Keep this habit.',
      review_rating: 5,
      review_count: 2,
      last_reviewed_at: nowIso,
      created_at: subDays(new Date(), 1).toISOString(),
      updated_at: subDays(new Date(), 1).toISOString(),
    },
    {
      id: 'seed-note-3',
      user_id: userId,
      user_email: userEmail,
      note_date: threeDaysAgo,
      title: 'Design System & Typography Notes',
      content: `## Editorial Contrast\nCombining a warm serif display face (*Newsreader*) for note titles with a crisp geometric sans-serif (*Inter*) for UI controls gives the workspace an atmospheric, distraction-free studio feel.\n\n\`\`\`css\n:root {\n  --font-display: 'Newsreader', Georgia, serif;\n  --font-sans: 'Inter', system-ui, sans-serif;\n}\n\`\`\`\n\n- High contrast dark slate surfaces reduce eye strain during evening review sessions.`,
      mood: 'inspired',
      tags: ['design', 'ui', 'typography'],
      is_pinned: true,
      is_reviewed: false,
      review_notes: '',
      review_rating: null,
      review_count: 0,
      last_reviewed_at: null,
      created_at: subDays(new Date(), 3).toISOString(),
      updated_at: subDays(new Date(), 3).toISOString(),
    },
    {
      id: 'seed-note-4',
      user_id: userId,
      user_email: userEmail,
      note_date: fiveDaysAgo,
      title: 'Weekly Gratitude & Milestone Log',
      content: `## Three Things I'm Grateful For\n1. Meaningful conversations with the engineering team.\n2. Consistent daily writing streak.\n3. Clear roadmap for the upcoming quarter.\n\n### Notes for Future Review\nLook back at this entry at the end of the month to see how the roadmap evolved.`,
      mood: 'grateful',
      tags: ['gratitude', 'milestones', 'journal'],
      is_pinned: false,
      is_reviewed: true,
      review_notes: 'Great reminder to pause and celebrate small wins each Friday.',
      review_rating: 4,
      review_count: 1,
      last_reviewed_at: subDays(new Date(), 2).toISOString(),
      created_at: subDays(new Date(), 5).toISOString(),
      updated_at: subDays(new Date(), 5).toISOString(),
    },
  ];
}

function loadLocalNotes(userId: string, userEmail: string): Note[] {
  const raw = localStorage.getItem(getLocalNotesKey(userId));
  if (!raw) {
    const seeded = getSeedNotes(userId, userEmail);
    localStorage.setItem(getLocalNotesKey(userId), JSON.stringify(seeded));
    return seeded;
  }
  try {
    return JSON.parse(raw) as Note[];
  } catch {
    return [];
  }
}

function saveLocalNotes(userId: string, notes: Note[]): void {
  localStorage.setItem(getLocalNotesKey(userId), JSON.stringify(notes));
}

export interface FetchNotesResult {
  notes: Note[];
  source: 'supabase' | 'local';
  tableMissing?: boolean;
  error?: string;
}

export async function fetchUserNotes(
  userId: string,
  userEmail: string,
  isDemo?: boolean
): Promise<FetchNotesResult> {
  const supabase = getSupabaseClient();

  if (isDemo || !supabase) {
    return {
      notes: loadLocalNotes(userId, userEmail),
      source: 'local',
    };
  }

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_email', userEmail.toLowerCase())
    .order('note_date', { ascending: false })
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    const isTableMissing =
      error.code === '42P01' ||
      error.message?.toLowerCase().includes('relation') ||
      error.message?.toLowerCase().includes('does not exist') ||
      error.message?.toLowerCase().includes('schema cache');

    console.warn('Supabase fetch warning, falling back to local storage:', error.message);
    return {
      notes: loadLocalNotes(userId, userEmail),
      source: 'local',
      tableMissing: isTableMissing,
      error: error.message,
    };
  }

  const mapped: Note[] = (data || []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    user_email: row.user_email ? String(row.user_email) : userEmail,
    note_date: String(row.note_date),
    title: String(row.title || 'Untitled Note'),
    content: String(row.content || ''),
    mood: (row.mood as Note['mood']) || 'calm',
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    is_pinned: Boolean(row.is_pinned),
    is_reviewed: Boolean(row.is_reviewed),
    review_notes: String(row.review_notes || ''),
    review_rating: typeof row.review_rating === 'number' ? row.review_rating : null,
    review_count: typeof row.review_count === 'number' ? row.review_count : 0,
    last_reviewed_at: row.last_reviewed_at ? String(row.last_reviewed_at) : null,
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
  }));

  saveLocalNotes(userId, mapped);
  return {
    notes: mapped,
    source: 'supabase',
  };
}

export async function createNoteRecord(
  userId: string,
  userEmail: string,
  input: CreateNoteInput,
  isDemo?: boolean
): Promise<{ note: Note; synced: boolean; error?: string }> {
  const nowIso = new Date().toISOString();
  const localNote: Note = {
    id: crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}`,
    user_id: userId,
    user_email: userEmail,
    note_date: input.note_date,
    title: input.title.trim() || 'Untitled Note',
    content: input.content,
    mood: input.mood,
    tags: input.tags,
    is_pinned: Boolean(input.is_pinned),
    is_reviewed: false,
    review_notes: '',
    review_rating: null,
    review_count: 0,
    last_reviewed_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const supabase = getSupabaseClient();
  if (isDemo || !supabase) {
    const existing = loadLocalNotes(userId, userEmail);
    saveLocalNotes(userId, [localNote, ...existing]);
    return { note: localNote, synced: false };
  }

  const { data, error } = await supabase
    .from('notes')
    .insert([
      {
        user_id: userId,
        user_email: userEmail,
        note_date: input.note_date,
        title: input.title.trim() || 'Untitled Note',
        content: input.content,
        mood: input.mood,
        tags: input.tags,
        is_pinned: Boolean(input.is_pinned),
      },
    ])
    .select()
    .single();

  if (error || !data) {
    const existing = loadLocalNotes(userId, userEmail);
    saveLocalNotes(userId, [localNote, ...existing]);
    return { note: localNote, synced: false, error: error?.message };
  }

  const savedNote: Note = {
    ...localNote,
    id: String(data.id),
    created_at: String(data.created_at || nowIso),
    updated_at: String(data.updated_at || nowIso),
  };

  const existing = loadLocalNotes(userId, userEmail);
  saveLocalNotes(userId, [savedNote, ...existing]);
  return { note: savedNote, synced: true };
}

export async function updateNoteRecord(
  userId: string,
  userEmail: string,
  noteId: string,
  updates: UpdateNoteInput,
  isDemo?: boolean
): Promise<{ note: Note | null; synced: boolean; error?: string }> {
  const nowIso = new Date().toISOString();
  const existing = loadLocalNotes(userId, userEmail);
  const idx = existing.findIndex((n) => n.id === noteId);

  let updatedLocal: Note | null = null;
  if (idx !== -1) {
    updatedLocal = {
      ...existing[idx],
      ...updates,
      updated_at: nowIso,
    };
    existing[idx] = updatedLocal;
    saveLocalNotes(userId, existing);
  }

  const supabase = getSupabaseClient();
  if (isDemo || !supabase || noteId.startsWith('seed-note-')) {
    return { note: updatedLocal, synced: false };
  }

  const { data, error } = await supabase
    .from('notes')
    .update({
      ...updates,
      updated_at: nowIso,
    })
    .eq('id', noteId)
    .select()
    .single();

  if (error || !data) {
    return { note: updatedLocal, synced: false, error: error?.message };
  }

  return { note: updatedLocal, synced: true };
}

export async function deleteNoteRecord(
  userId: string,
  userEmail: string,
  noteId: string,
  isDemo?: boolean
): Promise<{ synced: boolean; error?: string }> {
  const existing = loadLocalNotes(userId, userEmail).filter((n) => n.id !== noteId);
  saveLocalNotes(userId, existing);

  const supabase = getSupabaseClient();
  if (isDemo || !supabase || noteId.startsWith('seed-note-')) {
    return { synced: false };
  }

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId);

  if (error) {
    return { synced: false, error: error.message };
  }

  return { synced: true };
}
