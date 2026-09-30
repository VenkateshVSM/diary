export type MoodType =
  | 'inspired'
  | 'calm'
  | 'productive'
  | 'reflective'
  | 'grateful'
  | 'challenged';

export interface Note {
  id: string;
  user_id: string;
  user_email?: string;
  note_date: string; // YYYY-MM-DD
  title: string;
  content: string;
  mood: MoodType;
  tags: string[];
  is_pinned: boolean;
  is_reviewed: boolean;
  review_notes: string;
  review_rating?: number | null;
  review_count: number;
  last_reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteInput {
  note_date: string;
  title: string;
  content: string;
  mood: MoodType;
  tags: string[];
  is_pinned?: boolean;
}

export interface UpdateNoteInput {
  note_date?: string;
  title?: string;
  content?: string;
  mood?: MoodType;
  tags?: string[];
  is_pinned?: boolean;
  is_reviewed?: boolean;
  review_notes?: string;
  review_rating?: number | null;
  review_count?: number;
  last_reviewed_at?: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  isDemo?: boolean;
}

export type AppViewMode = 'journal' | 'review' | 'insights';

export interface ReviewFilter {
  datePreset: 'all' | 'today' | 'week' | 'month' | 'custom';
  startDate: string;
  endDate: string;
  status: 'all' | 'unreviewed' | 'reviewed' | 'pinned';
  mood: MoodType | 'all';
  tag: string;
  search: string;
}

export const MOOD_META: Record<
  MoodType,
  { label: string; emoji: string; color: string; bg: string; border: string }
> = {
  inspired: {
    label: 'Inspired',
    emoji: '✨',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.14)',
    border: 'rgba(251, 191, 36, 0.35)',
  },
  calm: {
    label: 'Calm',
    emoji: '🌿',
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.14)',
    border: 'rgba(52, 211, 153, 0.35)',
  },
  productive: {
    label: 'Productive',
    emoji: '⚡',
    color: '#60a5fa',
    bg: 'rgba(96, 165, 250, 0.14)',
    border: 'rgba(96, 165, 250, 0.35)',
  },
  reflective: {
    label: 'Reflective',
    emoji: '🌙',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.14)',
    border: 'rgba(167, 139, 250, 0.35)',
  },
  grateful: {
    label: 'Grateful',
    emoji: '☀️',
    color: '#f472b6',
    bg: 'rgba(244, 114, 182, 0.14)',
    border: 'rgba(244, 114, 182, 0.35)',
  },
  challenged: {
    label: 'Challenged',
    emoji: '🔥',
    color: '#fb923c',
    bg: 'rgba(251, 146, 60, 0.14)',
    border: 'rgba(251, 146, 60, 0.35)',
  },
};
