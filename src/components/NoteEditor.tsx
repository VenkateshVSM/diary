import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Pin,
  Trash2,
  CheckCircle2,
  Sparkles,
  Bold,
  Italic,
  Heading2,
  List,
  CheckSquare,
  Quote,
  Code,
  Eye,
  Edit3,
  Columns,
  Tag,
  Plus,
  X,
  Star,
  Calendar,
  Clock,
  Save,
} from 'lucide-react';
import { MOOD_META, MoodType, Note, UpdateNoteInput } from '../types/note';

interface NoteEditorProps {
  note: Note;
  onUpdateNote: (noteId: string, updates: UpdateNoteInput) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  onUpdateNote,
  onDeleteNote,
}) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [noteDate, setNoteDate] = useState(note.note_date);
  const [mood, setMood] = useState<MoodType>(note.mood);
  const [tags, setTags] = useState<string[]>(note.tags);
  const [tagInput, setTagInput] = useState('');
  const [editorMode, setEditorMode] = useState<'write' | 'split' | 'preview'>('split');
  const [showReviewDrawer, setShowReviewDrawer] = useState(false);
  const [reviewNotes, setReviewNotes] = useState(note.review_notes || '');
  const [reviewRating, setReviewRating] = useState<number>(note.review_rating || 5);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Sync state when switching to a different note
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setNoteDate(note.note_date);
    setMood(note.mood);
    setTags(note.tags);
    setReviewNotes(note.review_notes || '');
    setReviewRating(note.review_rating || 5);
    setSaveState('saved');
  }, [note.id]);

  // Debounced auto-save when title or content changes
  useEffect(() => {
    if (
      title === note.title &&
      content === note.content &&
      noteDate === note.note_date &&
      mood === note.mood &&
      JSON.stringify(tags) === JSON.stringify(note.tags)
    ) {
      return;
    }

    setSaveState('unsaved');
    const timer = setTimeout(async () => {
      setSaveState('saving');
      await onUpdateNote(note.id, {
        title: title.trim() || 'Untitled Note',
        content,
        note_date: noteDate,
        mood,
        tags,
      });
      setSaveState('saved');
    }, 600);

    return () => clearTimeout(timer);
  }, [title, content, noteDate, mood, tags]);

  const insertFormatting = (prefix: string, suffix = '') => {
    setContent((prev) => `${prev}${prev.endsWith('\n') || !prev ? '' : '\n'}${prefix}${suffix}`);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (cleaned && !tags.includes(cleaned)) {
      setTags([...tags, cleaned]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleToggleChecklistLine = (lineIndex: number) => {
    const lines = content.split('\n');
    const line = lines[lineIndex];
    if (line.includes('- [ ] ')) {
      lines[lineIndex] = line.replace('- [ ] ', '- [x] ');
    } else if (line.includes('- [x] ')) {
      lines[lineIndex] = line.replace('- [x] ', '- [ ] ');
    }
    setContent(lines.join('\n'));
  };

  const handleCompleteReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveState('saving');
    const nowIso = new Date().toISOString();
    await onUpdateNote(note.id, {
      is_reviewed: true,
      review_notes: reviewNotes.trim(),
      review_rating: reviewRating,
      review_count: (note.review_count || 0) + 1,
      last_reviewed_at: nowIso,
    });
    setSaveState('saved');
    setShowReviewDrawer(false);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  const renderMarkdownPreview = () => {
    if (!content.trim()) {
      return (
        <p className="empty-preview-placeholder">
          Start writing your note for this date... Supports headings, checklists, quotes, and code.
        </p>
      );
    }

    const lines = content.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="md-h3">
            {line.slice(4)}
          </h4>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h3 key={idx} className="md-h2">
            {line.slice(3)}
          </h3>
        );
      }
      if (line.startsWith('# ')) {
        return (
          <h2 key={idx} className="md-h1">
            {line.slice(2)}
          </h2>
        );
      }
      if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
        const checked = line.startsWith('- [x] ');
        const text = line.slice(6);
        return (
          <label key={idx} className={`md-checklist-item ${checked ? 'checked' : ''}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => handleToggleChecklistLine(idx)}
            />
            <span>{text}</span>
          </label>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <li key={idx} className="md-bullet">
            {line.slice(2)}
          </li>
        );
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} className="md-quote">
            {line.slice(2)}
          </blockquote>
        );
      }
      if (line.startsWith('```')) {
        return null;
      }
      if (!line.trim()) {
        return <div key={idx} className="md-spacer" />;
      }

      // Format bold **text** and italic *text*
      const formattedParts = line.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g).map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={pIdx}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={pIdx} className="md-inline-code">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });

      return (
        <p key={idx} className="md-paragraph">
          {formattedParts}
        </p>
      );
    });
  };

  return (
    <div className="note-editor-container">
      {/* Top Bar: Date Selector, Pin, Review Button, Delete */}
      <div className="editor-topbar">
        <div className="editor-date-meta">
          <div className="date-badge-picker">
            <Calendar size={14} />
            <input
              type="date"
              value={noteDate}
              onChange={(e) => {
                if (e.target.value) setNoteDate(e.target.value);
              }}
              className="inline-date-input"
              title="Change the date of this note"
            />
          </div>

          <span className="save-indicator">
            <Save size={13} />
            {saveState === 'saving'
              ? 'Saving...'
              : saveState === 'unsaved'
              ? 'Editing...'
              : 'Saved'}
          </span>

          <span className="word-count-pill">
            <Clock size={13} />
            {wordCount} words • {readingTimeMin} min read
          </span>
        </div>

        <div className="editor-actions">
          <button
            type="button"
            className={`btn-chip ${note.is_pinned ? 'active-pin' : ''}`}
            onClick={() => onUpdateNote(note.id, { is_pinned: !note.is_pinned })}
            title={note.is_pinned ? 'Unpin note' : 'Pin note'}
          >
            <Pin size={14} />
            <span>{note.is_pinned ? 'Pinned' : 'Pin'}</span>
          </button>

          <button
            type="button"
            className={`btn-chip ${note.is_reviewed ? 'reviewed-chip' : 'review-prompt-chip'}`}
            onClick={() => setShowReviewDrawer(!showReviewDrawer)}
          >
            {note.is_reviewed ? <CheckCircle2 size={14} /> : <Sparkles size={14} />}
            <span>
              {note.is_reviewed
                ? `Reviewed (${note.review_count}x)`
                : 'Review & Reflect'}
            </span>
          </button>

          <button
            type="button"
            className="icon-btn danger"
            onClick={() => onDeleteNote(note.id)}
            title="Delete this note"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Collapsible Review & Reflection Drawer */}
      {showReviewDrawer && (
        <form onSubmit={handleCompleteReview} className="review-drawer">
          <div className="review-drawer-header">
            <div>
              <h4>
                <Sparkles size={16} /> Date Reflection & Review Log
              </h4>
              <p>
                Reviewing note from{' '}
                <strong>{format(parseISO(noteDate), 'EEEE, MMMM d, yyyy')}</strong>
              </p>
            </div>
            <div className="rating-selector">
              <span>Clarity / Value Rating:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`star-btn ${reviewRating >= star ? 'filled' : ''}`}
                  onClick={() => setReviewRating(star)}
                >
                  <Star size={16} />
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Write your reflection or takeaway after reviewing this note... What did you learn or follow up on?"
            className="review-textarea"
            rows={3}
          />

          <div className="review-drawer-footer">
            {note.last_reviewed_at && (
              <span className="last-reviewed-label">
                Last reviewed: {format(parseISO(note.last_reviewed_at), 'MMM d, yyyy h:mm a')}
              </span>
            )}
            <div className="drawer-btns">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowReviewDrawer(false)}
              >
                Close
              </button>
              <button type="submit" className="btn btn-primary">
                <CheckCircle2 size={15} />
                <span>Save Reflection & Mark Reviewed</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Existing Review Takeaway Banner (when drawer is closed) */}
      {!showReviewDrawer && note.is_reviewed && note.review_notes && (
        <div className="reviewed-summary-banner" onClick={() => setShowReviewDrawer(true)}>
          <div className="banner-left">
            <CheckCircle2 size={16} className="text-emerald" />
            <div>
              <strong>Review Reflection:</strong> {note.review_notes}
            </div>
          </div>
          {note.review_rating && (
            <span className="rating-pill">{'★'.repeat(note.review_rating)}</span>
          )}
        </div>
      )}

      {/* Note Title Input */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note Title..."
        className="note-title-input"
      />

      {/* Mood & Tags Bar */}
      <div className="mood-tags-bar">
        <div className="mood-selector">
          {(Object.keys(MOOD_META) as MoodType[]).map((mKey) => {
            const meta = MOOD_META[mKey];
            const active = mood === mKey;
            return (
              <button
                key={mKey}
                type="button"
                onClick={() => setMood(mKey)}
                className={`mood-pill ${active ? 'active' : ''}`}
                style={
                  active
                    ? {
                        backgroundColor: meta.bg,
                        borderColor: meta.border,
                        color: meta.color,
                      }
                    : undefined
                }
              >
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        <div className="tags-editor">
          <Tag size={13} className="tag-icon" />
          {tags.map((t) => (
            <span key={t} className="tag-chip">
              #{t}
              <button type="button" onClick={() => handleRemoveTag(t)}>
                <X size={11} />
              </button>
            </span>
          ))}
          <form onSubmit={handleAddTag} className="add-tag-form">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="+ Add tag"
              className="tag-input"
            />
            {tagInput.trim() && (
              <button type="submit" className="tag-submit-btn">
                <Plus size={12} />
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Formatting & View Mode Toolbar */}
      <div className="formatting-toolbar">
        <div className="format-buttons">
          <button
            type="button"
            onClick={() => insertFormatting('## Heading ')}
            title="Add Heading"
            className="toolbar-btn"
          >
            <Heading2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('**Bold text**')}
            title="Bold"
            className="toolbar-btn"
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('*Italic text*')}
            title="Italic"
            className="toolbar-btn"
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('- [ ] Task item')}
            title="Interactive Checklist"
            className="toolbar-btn"
          >
            <CheckSquare size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('- Bullet point')}
            title="Bullet List"
            className="toolbar-btn"
          >
            <List size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('> Key quote or insight')}
            title="Blockquote"
            className="toolbar-btn"
          >
            <Quote size={15} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('`code snippet`')}
            title="Inline Code"
            className="toolbar-btn"
          >
            <Code size={15} />
          </button>
        </div>

        <div className="view-mode-pills">
          <button
            type="button"
            className={`mode-pill ${editorMode === 'write' ? 'active' : ''}`}
            onClick={() => setEditorMode('write')}
          >
            <Edit3 size={13} /> Write
          </button>
          <button
            type="button"
            className={`mode-pill ${editorMode === 'split' ? 'active' : ''}`}
            onClick={() => setEditorMode('split')}
          >
            <Columns size={13} /> Split
          </button>
          <button
            type="button"
            className={`mode-pill ${editorMode === 'preview' ? 'active' : ''}`}
            onClick={() => setEditorMode('preview')}
          >
            <Eye size={13} /> Preview
          </button>
        </div>
      </div>

      {/* Editor & Live Markdown Preview Body */}
      <div className={`editor-workspace mode-${editorMode}`}>
        {(editorMode === 'write' || editorMode === 'split') && (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your thoughts, daily logs, meeting notes, or reflections for this date..."
            className="note-content-textarea"
          />
        )}

        {(editorMode === 'preview' || editorMode === 'split') && (
          <div className="note-markdown-preview">{renderMarkdownPreview()}</div>
        )}
      </div>
    </div>
  );
};
