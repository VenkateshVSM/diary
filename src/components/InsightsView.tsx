import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Flame,
  CheckCircle2,
  BookOpen,
  Calendar,
  Sparkles,
  Award,
  ArrowUpRight,
} from 'lucide-react';
import { MOOD_META, MoodType, Note } from '../types/note';

interface InsightsViewProps {
  notes: Note[];
  onOpenNoteInJournal: (note: Note) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  notes,
  onOpenNoteInJournal,
}) => {
  const stats = useMemo(() => {
    const uniqueDates = new Set(notes.map((n) => n.note_date));
    const reviewedNotes = notes.filter((n) => n.is_reviewed);
    const totalReviewsCompleted = notes.reduce((acc, n) => acc + (n.review_count || 0), 0);
    const reviewRate =
      notes.length > 0 ? Math.round((reviewedNotes.length / notes.length) * 100) : 0;

    const moodCounts: Record<MoodType, number> = {
      inspired: 0,
      calm: 0,
      productive: 0,
      reflective: 0,
      grateful: 0,
      challenged: 0,
    };

    notes.forEach((n) => {
      if (moodCounts[n.mood] !== undefined) {
        moodCounts[n.mood] += 1;
      }
    });

    return {
      totalNotes: notes.length,
      activeDays: uniqueDates.size,
      reviewedCount: reviewedNotes.length,
      totalReviewsCompleted,
      reviewRate,
      moodCounts,
    };
  }, [notes]);

  const recentlyReviewed = useMemo(() => {
    return notes
      .filter((n) => n.is_reviewed)
      .sort((a, b) =>
        (b.last_reviewed_at || b.updated_at).localeCompare(
          a.last_reviewed_at || a.updated_at
        )
      )
      .slice(0, 5);
  }, [notes]);

  return (
    <div className="insights-view">
      <div className="review-header">
        <div>
          <div className="eyebrow-badge">
            <Award size={13} />
            <span>JOURNAL & REVIEW ANALYTICS</span>
          </div>
          <h2>Your Writing & Reflection Insights</h2>
          <p>Overview of your dated entries, mood trends, and review consistency.</p>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon amber">
            <BookOpen size={20} />
          </div>
          <div>
            <span className="kpi-value">{stats.totalNotes}</span>
            <span className="kpi-label">Total Dated Notes</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon violet">
            <Calendar size={20} />
          </div>
          <div>
            <span className="kpi-value">{stats.activeDays}</span>
            <span className="kpi-label">Days Logged</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon emerald">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="kpi-value">{stats.reviewRate}%</span>
            <span className="kpi-label">Review Completion Rate</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon pink">
            <Flame size={20} />
          </div>
          <div>
            <span className="kpi-value">{stats.totalReviewsCompleted}</span>
            <span className="kpi-label">Total Reflections Logged</span>
          </div>
        </div>
      </div>

      <div className="insights-columns">
        {/* Mood Distribution */}
        <div className="insight-panel">
          <h3>Mood Distribution Across Dates</h3>
          <div className="mood-bars">
            {(Object.keys(MOOD_META) as MoodType[]).map((moodKey) => {
              const meta = MOOD_META[moodKey];
              const count = stats.moodCounts[moodKey];
              const pct =
                stats.totalNotes > 0 ? Math.round((count / stats.totalNotes) * 100) : 0;

              return (
                <div key={moodKey} className="mood-bar-row">
                  <div className="mood-bar-label">
                    <span>
                      {meta.emoji} {meta.label}
                    </span>
                    <span className="mood-bar-count">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="mood-bar-track">
                    <div
                      className="mood-bar-fill"
                      style={{
                        width: `${Math.max(pct, count > 0 ? 6 : 0)}%`,
                        backgroundColor: meta.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Reflections */}
        <div className="insight-panel">
          <h3>Recent Reviewed Takeaways</h3>
          {recentlyReviewed.length === 0 ? (
            <p className="helper-text">
              No reviewed notes yet. Head to the Review & Reflect tab to review your notes!
            </p>
          ) : (
            <div className="recent-reflections-list">
              {recentlyReviewed.map((note) => (
                <div
                  key={note.id}
                  className="recent-reflection-item"
                  onClick={() => onOpenNoteInJournal(note)}
                >
                  <div className="reflection-item-top">
                    <span className="reflection-date">
                      {format(parseISO(note.note_date), 'MMM d, yyyy')}
                    </span>
                    {note.review_rating && (
                      <span className="stars-inline">{'★'.repeat(note.review_rating)}</span>
                    )}
                  </div>
                  <h4>{note.title}</h4>
                  {note.review_notes && <p>"{note.review_notes}"</p>}
                  <span className="open-mini-link">
                    View Entry <ArrowUpRight size={12} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
