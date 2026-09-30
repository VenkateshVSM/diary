import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Plus,
  Calendar,
  Sparkles,
  Pin,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Database,
} from 'lucide-react';
import { getSupabaseClient } from './lib/supabase';
import {
  createNoteRecord,
  deleteNoteRecord,
  fetchUserNotes,
  updateNoteRecord,
} from './services/noteService';
import { AppViewMode, MOOD_META, Note, UpdateNoteInput, UserProfile } from './types/note';
import { AuthScreen } from './components/AuthScreen';
import { SidebarCalendar } from './components/SidebarCalendar';
import { NoteEditor } from './components/NoteEditor';
import { ReviewCenter } from './components/ReviewCenter';
import { InsightsView } from './components/InsightsView';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';

const DEMO_SESSION_KEY = 'chronicle_demo_user';

export const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const savedDemo = localStorage.getItem(DEMO_SESSION_KEY);
    if (savedDemo) {
      try {
        return JSON.parse(savedDemo) as UserProfile;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [syncSource, setSyncSource] = useState<'supabase' | 'local'>('local');
  const [tableMissingWarning, setTableMissingWarning] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    format(new Date(), 'yyyy-MM-dd')
  );
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<AppViewMode>('journal');
  const [listFilterMode, setListFilterMode] = useState<'date' | 'all'>('date');
  const [quickSearch, setQuickSearch] = useState('');
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Listen to Supabase Auth state
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const email = session.user.email || 'user@gmail.com';
        setUser({
          id: session.user.id,
          email,
          name:
            (session.user.user_metadata?.full_name as string) ||
            (session.user.user_metadata?.name as string) ||
            email.split('@')[0],
          avatar_url: session.user.user_metadata?.avatar_url as string | undefined,
          isDemo: false,
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const email = session.user.email || 'user@gmail.com';
        localStorage.removeItem(DEMO_SESSION_KEY);
        setUser({
          id: session.user.id,
          email,
          name:
            (session.user.user_metadata?.full_name as string) ||
            (session.user.user_metadata?.name as string) ||
            email.split('@')[0],
          avatar_url: session.user.user_metadata?.avatar_url as string | undefined,
          isDemo: false,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadNotes = async (currentUser: UserProfile) => {
    setLoadingNotes(true);
    const result = await fetchUserNotes(
      currentUser.id,
      currentUser.email,
      currentUser.isDemo
    );
    setNotes(result.notes);
    setSyncSource(result.source);
    setTableMissingWarning(Boolean(result.tableMissing));
    setLoadingNotes(false);

    // Select first note on selectedDate or overall
    const notesOnDate = result.notes.filter((n) => n.note_date === selectedDate);
    if (notesOnDate.length > 0) {
      setActiveNoteId(notesOnDate[0].id);
    } else if (result.notes.length > 0) {
      setActiveNoteId(result.notes[0].id);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotes(user);
    }
  }, [user?.id]);

  // Notes filtered for the middle list pane in Daily Workspace
  const displayedListNotes = useMemo(() => {
    let base =
      listFilterMode === 'date'
        ? notes.filter((n) => n.note_date === selectedDate)
        : notes;

    if (quickSearch.trim()) {
      const q = quickSearch.toLowerCase();
      base = base.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return [...base].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.note_date !== b.note_date) return a.note_date < b.note_date ? 1 : -1;
      return a.updated_at < b.updated_at ? 1 : -1;
    });
  }, [notes, selectedDate, listFilterMode, quickSearch]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) || null,
    [notes, activeNoteId]
  );

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setListFilterMode('date');
    const notesForDay = notes.filter((n) => n.note_date === dateStr);
    if (notesForDay.length > 0) {
      setActiveNoteId(notesForDay[0].id);
    } else {
      setActiveNoteId(null);
    }
  };

  const handleCreateNote = async (
    dateStr: string,
    templateTitle?: string,
    templateContent?: string,
    templateTags?: string[]
  ) => {
    if (!user) return;
    const formattedDate = format(parseISO(dateStr), 'MMM d, yyyy');
    const result = await createNoteRecord(
      user.id,
      user.email,
      {
        note_date: dateStr,
        title: templateTitle || `Journal Entry — ${formattedDate}`,
        content:
          templateContent ||
          `## Notes for ${formattedDate}\n\n- [ ] Key priority for today\n- \n\n### Reflection\n`,
        mood: 'calm',
        tags: templateTags || ['daily'],
        is_pinned: false,
      },
      user.isDemo
    );

    setNotes((prev) => [result.note, ...prev]);
    setSelectedDate(dateStr);
    setActiveNoteId(result.note.id);
    setViewMode('journal');
  };

  const handleUpdateNote = async (noteId: string, updates: UpdateNoteInput) => {
    if (!user) return;

    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              ...updates,
              updated_at: new Date().toISOString(),
            }
          : n
      )
    );

    if (updates.note_date && updates.note_date !== selectedDate) {
      setSelectedDate(updates.note_date);
    }

    await updateNoteRecord(user.id, user.email, noteId, updates, user.isDemo);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!user) return;
    const remaining = notes.filter((n) => n.id !== noteId);
    setNotes(remaining);

    if (activeNoteId === noteId) {
      const sameDayRemaining = remaining.filter((n) => n.note_date === selectedDate);
      setActiveNoteId(sameDayRemaining[0]?.id || remaining[0]?.id || null);
    }

    await deleteNoteRecord(user.id, user.email, noteId, user.isDemo);
  };

  const handleOpenNoteInJournal = (note: Note) => {
    setSelectedDate(note.note_date);
    setActiveNoteId(note.id);
    setViewMode('journal');
  };

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    localStorage.removeItem(DEMO_SESSION_KEY);
    localStorage.removeItem('chronicle_pending_gmail');
    localStorage.removeItem('chronicle_pending_name');
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setNotes([]);
    setActiveNoteId(null);
  };

  return (
    <div className="app-root">
      {!user ? (
        <AuthScreen
          onLoginSuccess={handleLoginSuccess}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        />
      ) : (
        <div className="workspace-shell">
          <SidebarCalendar
            user={user}
            notes={notes}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            onCreateNoteForDate={(d) => handleCreateNote(d)}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
            onLogout={handleLogout}
            syncSource={syncSource}
          />

          <main className="workspace-main">
            {/* Top alert if connected to Supabase but table `notes` hasn't been created yet */}
            {tableMissingWarning && (
              <div className="top-warning-banner">
                <div className="warning-left">
                  <AlertTriangle size={16} />
                  <span>
                    Connected to Supabase, but the <code>public.notes</code> table was not
                    found. Your notes are safely cached locally until you run the SQL schema.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsSupabaseModalOpen(true)}
                >
                  <Database size={14} /> View SQL Schema
                </button>
              </div>
            )}

            {viewMode === 'journal' && (
              <div className="journal-split-layout">
                {/* Middle Column: Date Notes List */}
                <section className="date-notes-list-pane">
                  <div className="pane-header">
                    <div>
                      <span className="pane-eyebrow">SELECTED DATE</span>
                      <h3 className="pane-date-title">
                        {format(parseISO(selectedDate), 'EEE, MMM d, yyyy')}
                      </h3>
                    </div>
                    <button
                      type="button"
                      className="icon-btn-primary"
                      onClick={() => handleCreateNote(selectedDate)}
                      title="Create note for this date"
                    >
                      <Plus size={17} />
                    </button>
                  </div>

                  {/* Toggle between Selected Date Notes vs All Dates */}
                  <div className="pane-filter-tabs">
                    <button
                      type="button"
                      className={`pane-tab ${listFilterMode === 'date' ? 'active' : ''}`}
                      onClick={() => setListFilterMode('date')}
                    >
                      On {format(parseISO(selectedDate), 'MMM d')} (
                      {notes.filter((n) => n.note_date === selectedDate).length})
                    </button>
                    <button
                      type="button"
                      className={`pane-tab ${listFilterMode === 'all' ? 'active' : ''}`}
                      onClick={() => setListFilterMode('all')}
                    >
                      All Dates ({notes.length})
                    </button>
                  </div>

                  <div className="pane-search">
                    <Search size={14} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Filter notes..."
                      value={quickSearch}
                      onChange={(e) => setQuickSearch(e.target.value)}
                      className="pane-search-input"
                    />
                  </div>

                  <div className="note-items-scroll">
                    {loadingNotes ? (
                      <div className="pane-empty">Loading your notes...</div>
                    ) : displayedListNotes.length === 0 ? (
                      <div className="pane-empty">
                        <Calendar size={24} className="text-muted" />
                        <p>
                          No notes recorded for{' '}
                          <strong>{format(parseISO(selectedDate), 'MMM d, yyyy')}</strong> yet.
                        </p>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCreateNote(selectedDate)}
                        >
                          <Plus size={14} /> Write First Note
                        </button>
                      </div>
                    ) : (
                      displayedListNotes.map((item) => {
                        const moodMeta = MOOD_META[item.mood] || MOOD_META.calm;
                        const isSelected = item.id === activeNote?.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => setActiveNoteId(item.id)}
                            className={`note-list-card ${isSelected ? 'active' : ''}`}
                          >
                            <div className="note-card-top">
                              <span className="note-card-date">
                                {format(parseISO(item.note_date), 'MMM d, yyyy')}
                              </span>
                              <div className="note-card-icons">
                                {item.is_pinned && (
                                  <Pin size={12} className="text-amber" />
                                )}
                                {item.is_reviewed && (
                                  <span title="Reviewed">
                                    <CheckCircle2
                                      size={13}
                                      className="text-emerald"
                                    />
                                  </span>
                                )}
                                <span title={moodMeta.label}>{moodMeta.emoji}</span>
                              </div>
                            </div>

                            <h4 className="note-card-title">{item.title}</h4>
                            <p className="note-card-snippet">
                              {item.content.replace(/[#*`>-]/g, '').slice(0, 90) ||
                                'Empty note...'}
                            </p>

                            {item.tags.length > 0 && (
                              <div className="note-card-tags">
                                {item.tags.slice(0, 3).map((t) => (
                                  <span key={t} className="micro-tag">
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* Right Column: Active Note Editor or Empty Date Prompt */}
                <section className="editor-main-pane">
                  {activeNote ? (
                    <NoteEditor
                      note={activeNote}
                      onUpdateNote={handleUpdateNote}
                      onDeleteNote={handleDeleteNote}
                    />
                  ) : (
                    <div className="empty-editor-stage">
                      <div className="empty-stage-card">
                        <div className="icon-badge amber lg">
                          <FileText size={24} />
                        </div>
                        <h2>
                          Start noting for{' '}
                          {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
                        </h2>
                        <p>
                          Create a blank dated entry or pick a structured template below to
                          capture your thoughts and review them later.
                        </p>

                        <div className="template-grid">
                          <button
                            type="button"
                            className="template-card"
                            onClick={() =>
                              handleCreateNote(
                                selectedDate,
                                `Daily Focus — ${format(parseISO(selectedDate), 'MMM d')}`,
                                `## Top 3 Priorities Today\n- [ ] \n- [ ] \n- [ ] \n\n## Key Notes & Observations\n\n## End-of-Day Reflection\n`,
                                ['daily', 'focus']
                              )
                            }
                          >
                            <Sparkles size={18} className="text-amber" />
                            <div>
                              <h4>Daily Focus & Priorities</h4>
                              <span>Checklist + observations + reflection</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            className="template-card"
                            onClick={() =>
                              handleCreateNote(
                                selectedDate,
                                `Meeting & Project Log — ${format(
                                  parseISO(selectedDate),
                                  'MMM d'
                                )}`,
                                `## Context & Attendees\n\n## Key Decisions Made\n- \n\n## Action Items for Review\n- [ ] `,
                                ['meeting', 'work']
                              )
                            }
                          >
                            <Calendar size={18} className="text-violet" />
                            <div>
                              <h4>Meeting & Decision Log</h4>
                              <span>Structured notes & follow-up items</span>
                            </div>
                          </button>
                        </div>

                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleCreateNote(selectedDate)}
                        >
                          <Plus size={16} />
                          <span>Create Blank Note for {format(parseISO(selectedDate), 'MMM d')}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {viewMode === 'review' && (
              <ReviewCenter
                notes={notes}
                onUpdateNote={handleUpdateNote}
                onOpenNoteInJournal={handleOpenNoteInJournal}
              />
            )}

            {viewMode === 'insights' && (
              <InsightsView
                notes={notes}
                onOpenNoteInJournal={handleOpenNoteInJournal}
              />
            )}
          </main>
        </div>
      )}

      <SupabaseSetupModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigUpdated={() => {
          if (user) {
            loadNotes(user);
          }
        }}
        tableMissingWarning={tableMissingWarning}
      />
    </div>
  );
};

export default App;
