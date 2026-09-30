import React, { useMemo, useState } from 'react';
import {
  format,
  parseISO,
  subDays,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from 'date-fns';
import {
  Sparkles,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  Star,
  Pin,
  Layers,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react';
import { MOOD_META, MoodType, Note, ReviewFilter, UpdateNoteInput } from '../types/note';

interface ReviewCenterProps {
  notes: Note[];
  onUpdateNote: (noteId: string, updates: UpdateNoteInput) => Promise<void>;
  onOpenNoteInJournal: (note: Note) => void;
}

export const ReviewCenter: React.FC<ReviewCenterProps> = ({
  notes,
  onUpdateNote,
  onOpenNoteInJournal,
}) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const sevenDaysAgoStr = format(subDays(new Date(), 7), 'yyyy-MM-dd');

  const [filter, setFilter] = useState<ReviewFilter>({
    datePreset: 'all',
    startDate: sevenDaysAgoStr,
    endDate: todayStr,
    status: 'all',
    mood: 'all',
    tag: 'all',
    search: '',
  });

  const [reviewLayout, setReviewLayout] = useState<'timeline' | 'deck'>('timeline');
  const [deckIndex, setDeckIndex] = useState(0);
  const [deckReflection, setDeckReflection] = useState('');
  const [deckRating, setDeckRating] = useState<number>(5);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const now = new Date();
    return notes.filter((note) => {
      // 1. Date preset filter
      if (filter.datePreset === 'today') {
        if (note.note_date !== todayStr) return false;
      } else if (filter.datePreset === 'week') {
        const noteDateObj = parseISO(note.note_date);
        if (
          !isWithinInterval(noteDateObj, {
            start: subDays(now, 7),
            end: now,
          })
        ) {
          return false;
        }
      } else if (filter.datePreset === 'month') {
        const noteDateObj = parseISO(note.note_date);
        if (
          !isWithinInterval(noteDateObj, {
            start: startOfMonth(now),
            end: endOfMonth(now),
          })
        ) {
          return false;
        }
      } else if (filter.datePreset === 'custom') {
        if (filter.startDate && note.note_date < filter.startDate) return false;
        if (filter.endDate && note.note_date > filter.endDate) return false;
      }

      // 2. Review status filter
      if (filter.status === 'unreviewed' && note.is_reviewed) return false;
      if (filter.status === 'reviewed' && !note.is_reviewed) return false;
      if (filter.status === 'pinned' && !note.is_pinned) return false;

      // 3. Mood filter
      if (filter.mood !== 'all' && note.mood !== filter.mood) return false;

      // 4. Tag filter
      if (filter.tag !== 'all' && !note.tags.includes(filter.tag)) return false;

      // 5. Search query
      if (filter.search.trim()) {
        const q = filter.search.toLowerCase();
        const matchesTitle = note.title.toLowerCase().includes(q);
        const matchesContent = note.content.toLowerCase().includes(q);
        const matchesReview = (note.review_notes || '').toLowerCase().includes(q);
        const matchesDate = note.note_date.includes(q);
        if (!matchesTitle && !matchesContent && !matchesReview && !matchesDate) {
          return false;
        }
      }

      return true;
    });
  }, [notes, filter, todayStr]);

  // Group filtered notes by date for Timeline view
  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: Note[] }[] = [];
    const map = new Map<string, Note[]>();

    for (const n of filteredNotes) {
      if (!map.has(n.note_date)) {
        map.set(n.note_date, []);
      }
      map.get(n.note_date)!.push(n);
    }

    Array.from(map.keys())
      .sort((a, b) => (a < b ? 1 : -1))
      .forEach((date) => {
        groups.push({ date, items: map.get(date)! });
      });

    return groups;
  }, [filteredNotes]);

  const currentDeckNote = filteredNotes[deckIndex] || null;

  const handleSelectDeckIndex = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= filteredNotes.length) return;
    setDeckIndex(newIndex);
    const target = filteredNotes[newIndex];
    if (target) {
      setDeckReflection(target.review_notes || '');
      setDeckRating(target.review_rating || 5);
    }
  };

  const handleSwitchToDeck = () => {
    setReviewLayout('deck');
    setDeckIndex(0);
    if (filteredNotes[0]) {
      setDeckReflection(filteredNotes[0].review_notes || '');
      setDeckRating(filteredNotes[0].review_rating || 5);
    }
  };

  const handleDeckSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDeckNote) return;

    await onUpdateNote(currentDeckNote.id, {
      is_reviewed: true,
      review_notes: deckReflection.trim(),
      review_rating: deckRating,
      review_count: (currentDeckNote.review_count || 0) + 1,
      last_reviewed_at: new Date().toISOString(),
    });

    if (deckIndex + 1 < filteredNotes.length) {
      handleSelectDeckIndex(deckIndex + 1);
    }
  };

  const handleQuickToggleReview = async (note: Note) => {
    const nextReviewed = !note.is_reviewed;
    await onUpdateNote(note.id, {
      is_reviewed: nextReviewed,
      review_count: nextReviewed ? (note.review_count || 0) + 1 : note.review_count,
      last_reviewed_at: nextReviewed ? new Date().toISOString() : note.last_reviewed_at,
    });
  };

  const totalUnreviewed = notes.filter((n) => !n.is_reviewed).length;
  const totalReviewed = notes.filter((n) => n.is_reviewed).length;

  return (
    <div className="review-center">
      {/* Header Banner */}
      <div className="review-header">
        <div>
          <div className="eyebrow-badge">
            <Sparkles size={13} />
            <span>DATE-BASED REVIEW & REFLECTION</span>
          </div>
          <h2>Review Your Notes Across Time</h2>
          <p>
            Filter notes by specific dates, revisit past thoughts, and record your reflection
            takeaways.
          </p>
        </div>

        <div className="review-header-stats">
          <div className="mini-stat-box">
            <span className="stat-num emerald">{totalReviewed}</span>
            <span className="stat-label">Reviewed</span>
          </div>
          <div className="mini-stat-box">
            <span className="stat-num amber">{totalUnreviewed}</span>
            <span className="stat-label">Pending Review</span>
          </div>

          <div className="layout-switcher">
            <button
              type="button"
              className={`layout-btn ${reviewLayout === 'timeline' ? 'active' : ''}`}
              onClick={() => setReviewLayout('timeline')}
            >
              <LayoutGrid size={15} />
              <span>Date Timeline</span>
            </button>
            <button
              type="button"
              className={`layout-btn ${reviewLayout === 'deck' ? 'active' : ''}`}
              onClick={handleSwitchToDeck}
            >
              <Layers size={15} />
              <span>Flashcard Deck</span>
            </button>
          </div>
        </div>
      </div>

      {/* Comprehensive Filter Bar */}
      <div className="review-filters-card">
        <div className="filter-row top">
          {/* Search Input */}
          <div className="search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search notes, reflections, or YYYY-MM-DD..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="search-input"
            />
          </div>

          {/* Date Preset Pills */}
          <div className="date-preset-group">
            <span className="filter-label">
              <Calendar size={13} /> Date:
            </span>
            {(
              [
                { id: 'all', label: 'All Dates' },
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'Last 7 Days' },
                { id: 'month', label: 'This Month' },
                { id: 'custom', label: 'Custom Date Range' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`filter-pill ${filter.datePreset === preset.id ? 'active' : ''}`}
                onClick={() => {
                  setFilter({ ...filter, datePreset: preset.id });
                  setDeckIndex(0);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Pickers */}
        {filter.datePreset === 'custom' && (
          <div className="custom-date-range-bar">
            <div className="range-field">
              <label>From Date:</label>
              <input
                type="date"
                value={filter.startDate}
                onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                className="date-jump-input"
              />
            </div>
            <div className="range-field">
              <label>To Date:</label>
              <input
                type="date"
                value={filter.endDate}
                onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                className="date-jump-input"
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                setFilter({
                  ...filter,
                  startDate: todayStr,
                  endDate: todayStr,
                })
              }
            >
              Single Day ({todayStr})
            </button>
          </div>
        )}

        <div className="filter-row bottom">
          {/* Status Filter */}
          <div className="status-filter-group">
            <span className="filter-label">Status:</span>
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'unreviewed', label: 'Needs Review' },
                { id: 'reviewed', label: 'Reviewed' },
                { id: 'pinned', label: 'Pinned' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                className={`filter-pill ${filter.status === st.id ? 'active' : ''}`}
                onClick={() => {
                  setFilter({ ...filter, status: st.id });
                  setDeckIndex(0);
                }}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Mood Dropdown & Tag Dropdown */}
          <div className="select-filters">
            <select
              value={filter.mood}
              onChange={(e) =>
                setFilter({ ...filter, mood: e.target.value as MoodType | 'all' })
              }
              className="filter-select"
            >
              <option value="all">All Moods</option>
              {(Object.keys(MOOD_META) as MoodType[]).map((m) => (
                <option key={m} value={m}>
                  {MOOD_META[m].emoji} {MOOD_META[m].label}
                </option>
              ))}
            </select>

            <select
              value={filter.tag}
              onChange={(e) => setFilter({ ...filter, tag: e.target.value })}
              className="filter-select"
            >
              <option value="all">All Tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>

            {(filter.datePreset !== 'all' ||
              filter.status !== 'all' ||
              filter.mood !== 'all' ||
              filter.tag !== 'all' ||
              filter.search) && (
              <button
                type="button"
                className="btn-reset-filters"
                onClick={() =>
                  setFilter({
                    datePreset: 'all',
                    startDate: sevenDaysAgoStr,
                    endDate: todayStr,
                    status: 'all',
                    mood: 'all',
                    tag: 'all',
                    search: '',
                  })
                }
              >
                <RotateCcw size={13} /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Content */}
      {filteredNotes.length === 0 ? (
        <div className="empty-state-card">
          <Sparkles size={32} className="text-violet" />
          <h3>No notes match your current review filter</h3>
          <p>Try expanding your date range or clearing the search filters above.</p>
        </div>
      ) : reviewLayout === 'timeline' ? (
        <div className="timeline-groups">
          {groupedByDate.map((group) => (
            <div key={group.date} className="timeline-date-section">
              <div className="timeline-date-header">
                <div className="date-pill-badge">
                  <Calendar size={14} />
                  <span>{format(parseISO(group.date), 'EEEE, MMMM d, yyyy')}</span>
                </div>
                <span className="date-note-count">{group.items.length} note(s)</span>
              </div>

              <div className="review-cards-grid">
                {group.items.map((note) => {
                  const moodMeta = MOOD_META[note.mood] || MOOD_META.calm;
                  return (
                    <div
                      key={note.id}
                      className={`review-note-card ${note.is_reviewed ? 'is-reviewed' : 'unreviewed'}`}
                    >
                      <div className="review-card-top">
                        <span
                          className="mood-badge-sm"
                          style={{
                            backgroundColor: moodMeta.bg,
                            borderColor: moodMeta.border,
                            color: moodMeta.color,
                          }}
                        >
                          {moodMeta.emoji} {moodMeta.label}
                        </span>

                        <div className="card-badges-right">
                          {note.is_pinned && (
                            <span className="pin-mini-badge" title="Pinned">
                              <Pin size={12} />
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleQuickToggleReview(note)}
                            className={`status-toggle-btn ${
                              note.is_reviewed ? 'reviewed' : 'pending'
                            }`}
                          >
                            {note.is_reviewed ? (
                              <>
                                <CheckCircle2 size={13} /> Reviewed ({note.review_count}x)
                              </>
                            ) : (
                              <>
                                <Clock size={13} /> Mark Reviewed
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <h3
                        className="review-card-title"
                        onClick={() => onOpenNoteInJournal(note)}
                      >
                        {note.title}
                      </h3>

                      <p className="review-card-excerpt">
                        {note.content.replace(/[#*`>-]/g, '').slice(0, 180)}
                        {note.content.length > 180 ? '...' : ''}
                      </p>

                      {note.tags.length > 0 && (
                        <div className="review-card-tags">
                          {note.tags.map((t) => (
                            <span key={t} className="mini-tag">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      {note.review_notes && (
                        <div className="review-reflection-box">
                          <div className="reflection-header">
                            <span>Reflection Takeaway</span>
                            {note.review_rating && (
                              <span className="stars-inline">
                                {'★'.repeat(note.review_rating)}
                              </span>
                            )}
                          </div>
                          <p>{note.review_notes}</p>
                        </div>
                      )}

                      <div className="review-card-footer">
                        <span className="timestamp-meta">
                          Noted on {format(parseISO(note.note_date), 'MMM d, yyyy')}
                        </span>
                        <button
                          type="button"
                          className="open-note-link"
                          onClick={() => onOpenNoteInJournal(note)}
                        >
                          <span>Open & Edit</span>
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Interactive Flashcard Review Deck */
        currentDeckNote && (
          <div className="flashcard-deck-container">
            <div className="deck-progress-bar">
              <span>
                Reviewing Card <strong>{deckIndex + 1}</strong> of{' '}
                <strong>{filteredNotes.length}</strong>
              </span>
              <div className="deck-nav-buttons">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={deckIndex === 0}
                  onClick={() => handleSelectDeckIndex(deckIndex - 1)}
                >
                  <ChevronLeft size={15} /> Previous
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={deckIndex >= filteredNotes.length - 1}
                  onClick={() => handleSelectDeckIndex(deckIndex + 1)}
                >
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </div>

            <div className="flashcard-stage">
              <div className="flashcard-note-side">
                <div className="flashcard-meta">
                  <span className="date-pill-badge">
                    <Calendar size={14} />
                    {format(parseISO(currentDeckNote.note_date), 'EEEE, MMMM d, yyyy')}
                  </span>
                  <span
                    className="mood-badge-sm"
                    style={{
                      backgroundColor: MOOD_META[currentDeckNote.mood].bg,
                      borderColor: MOOD_META[currentDeckNote.mood].border,
                      color: MOOD_META[currentDeckNote.mood].color,
                    }}
                  >
                    {MOOD_META[currentDeckNote.mood].emoji}{' '}
                    {MOOD_META[currentDeckNote.mood].label}
                  </span>
                </div>

                <h2 className="flashcard-title">{currentDeckNote.title}</h2>

                <div className="flashcard-body-scroll">
                  {currentDeckNote.content.split('\n').map((line, i) => (
                    <p key={i}>{line || '\u00A0'}</p>
                  ))}
                </div>

                <div className="flashcard-footer">
                  <div className="review-card-tags">
                    {currentDeckNote.tags.map((t) => (
                      <span key={t} className="mini-tag">
                        #{t}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => onOpenNoteInJournal(currentDeckNote)}
                  >
                    Open Full Editor →
                  </button>
                </div>
              </div>

              <form onSubmit={handleDeckSubmitReview} className="flashcard-reflection-side">
                <h3>
                  <Sparkles size={17} /> Record Your Review Reflection
                </h3>
                <p className="helper-text">
                  Looking back at this note from{' '}
                  <strong>{format(parseISO(currentDeckNote.note_date), 'MMM d, yyyy')}</strong>,
                  what stands out or needs follow-up?
                </p>

                <div className="deck-rating-box">
                  <label>Insight / Importance Rating</label>
                  <div className="star-row">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`star-btn-lg ${deckRating >= star ? 'filled' : ''}`}
                        onClick={() => setDeckRating(star)}
                      >
                        <Star size={20} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Review Takeaway & Action Notes</label>
                  <textarea
                    rows={5}
                    value={deckReflection}
                    onChange={(e) => setDeckReflection(e.target.value)}
                    placeholder="Write your takeaway, progress update, or reflection..."
                    className="review-textarea"
                  />
                </div>

                <button type="submit" className="btn btn-primary full-width">
                  <CheckCircle2 size={16} />
                  <span>
                    {deckIndex + 1 < filteredNotes.length
                      ? 'Save Review & Next Note →'
                      : 'Complete Review'}
                  </span>
                </button>
              </form>
            </div>
          </div>
        )
      )}
    </div>
  );
};
