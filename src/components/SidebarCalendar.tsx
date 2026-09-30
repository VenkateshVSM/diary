import React, { useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';
import {
  BookOpen,
  Sparkles,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Plus,
  Database,
  LogOut,
  CheckCircle2,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { AppViewMode, MOOD_META, Note, UserProfile } from '../types/note';

interface SidebarCalendarProps {
  user: UserProfile;
  notes: Note[];
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  viewMode: AppViewMode;
  onChangeViewMode: (mode: AppViewMode) => void;
  onCreateNoteForDate: (dateStr: string) => void;
  onOpenSupabaseModal: () => void;
  onLogout: () => void;
  syncSource: 'supabase' | 'local';
}

export const SidebarCalendar: React.FC<SidebarCalendarProps> = ({
  user,
  notes,
  selectedDate,
  onSelectDate,
  viewMode,
  onChangeViewMode,
  onCreateNoteForDate,
  onOpenSupabaseModal,
  onLogout,
  syncSource,
}) => {
  const selectedDateObj = useMemo(() => parseISO(selectedDate), [selectedDate]);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(selectedDateObj));

  // Map YYYY-MM-DD -> Note[]
  const notesByDate = useMemo(() => {
    const map: Record<string, Note[]> = {};
    for (const note of notes) {
      if (!map[note.note_date]) {
        map[note.note_date] = [];
      }
      map[note.note_date].push(note);
    }
    return map;
  }, [notes]);

  const unreviewedCount = useMemo(
    () => notes.filter((n) => !n.is_reviewed).length,
    [notes]
  );

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const handleJumpToday = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setCurrentMonth(startOfMonth(new Date()));
    onSelectDate(todayStr);
    onChangeViewMode('journal');
  };

  const initials = useMemo(() => {
    return (user.name || user.email)
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [user]);

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-logo">
          <BookOpen size={18} />
        </div>
        <div>
          <h2 className="brand-title">Chronicle</h2>
          <span className="brand-tag">Dated Note & Review</span>
        </div>
      </div>

      {/* Primary Action: New Note for Selected Date */}
      <div className="sidebar-action">
        <button
          type="button"
          className="btn btn-primary full-width new-note-btn"
          onClick={() => onCreateNoteForDate(selectedDate)}
        >
          <Plus size={16} />
          <span>New Note on {format(selectedDateObj, 'MMM d')}</span>
        </button>
      </div>

      {/* Navigation Modes */}
      <nav className="sidebar-nav">
        <button
          type="button"
          className={`nav-item ${viewMode === 'journal' ? 'active' : ''}`}
          onClick={() => onChangeViewMode('journal')}
        >
          <CalendarIcon size={16} />
          <span>Daily Workspace</span>
          <span className="nav-badge">{notesByDate[selectedDate]?.length || 0}</span>
        </button>

        <button
          type="button"
          className={`nav-item ${viewMode === 'review' ? 'active' : ''}`}
          onClick={() => onChangeViewMode('review')}
        >
          <Sparkles size={16} />
          <span>Review & Reflect</span>
          {unreviewedCount > 0 ? (
            <span className="nav-badge highlight">{unreviewedCount} due</span>
          ) : (
            <span className="nav-badge success">All done</span>
          )}
        </button>

        <button
          type="button"
          className={`nav-item ${viewMode === 'insights' ? 'active' : ''}`}
          onClick={() => onChangeViewMode('insights')}
        >
          <BarChart3 size={16} />
          <span>Insights & Streaks</span>
        </button>
      </nav>

      {/* Interactive Monthly Calendar */}
      <div className="calendar-widget">
        <div className="calendar-header">
          <span className="calendar-month-label">{format(currentMonth, 'MMMM yyyy')}</span>
          <div className="calendar-controls">
            <button
              type="button"
              className="cal-today-btn"
              onClick={handleJumpToday}
              title="Jump to Today"
            >
              Today
            </button>
            <button
              type="button"
              className="icon-btn-sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              className="icon-btn-sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              aria-label="Next month"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="calendar-weekdays">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <span key={d} className="weekday-cell">
              {d}
            </span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayNotes = notesByDate[dateStr] || [];
            const isSelected = dateStr === selectedDate;
            const isToday = isSameDay(day, new Date());
            const inMonth = isSameMonth(day, currentMonth);
            const allReviewed =
              dayNotes.length > 0 && dayNotes.every((n) => n.is_reviewed);

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => {
                  onSelectDate(dateStr);
                  onChangeViewMode('journal');
                }}
                className={`calendar-day ${!inMonth ? 'outside' : ''} ${
                  isSelected ? 'selected' : ''
                } ${isToday ? 'today' : ''} ${dayNotes.length > 0 ? 'has-notes' : ''}`}
                title={`${format(day, 'MMM d, yyyy')} — ${dayNotes.length} note(s)`}
              >
                <span className="day-number">{format(day, 'd')}</span>
                {dayNotes.length > 0 && (
                  <div className="day-dots">
                    {dayNotes.slice(0, 3).map((n) => (
                      <span
                        key={n.id}
                        className="mood-dot"
                        style={{ backgroundColor: MOOD_META[n.mood]?.color || '#60a5fa' }}
                      />
                    ))}
                    {allReviewed && <span className="reviewed-mini-dot" title="Reviewed" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Direct Date Jump Input */}
        <div className="date-jump-row">
          <label htmlFor="sidebar-date-jump">Jump to date:</label>
          <input
            id="sidebar-date-jump"
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                onSelectDate(e.target.value);
                setCurrentMonth(startOfMonth(parseISO(e.target.value)));
                onChangeViewMode('journal');
              }
            }}
            className="date-jump-input"
          />
        </div>
      </div>

      {/* Footer: User Gmail Profile & Supabase Connection */}
      <div className="sidebar-footer">
        <button
          type="button"
          className="db-status-pill"
          onClick={onOpenSupabaseModal}
          title="Configure Supabase Database & SQL Schema"
        >
          <Database size={14} />
          <span>
            {syncSource === 'supabase' ? 'Supabase Cloud Synced' : 'Local / Setup Supabase'}
          </span>
          <CheckCircle2
            size={13}
            className={syncSource === 'supabase' ? 'text-emerald' : 'text-amber'}
          />
        </button>

        <div className="user-profile-row">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-email" title={user.email}>
              {user.email}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
