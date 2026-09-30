import React, { useState } from 'react';
import {
  Database,
  Key,
  CheckCircle2,
  Copy,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfigToLocal,
  clearLocalSupabaseConfig,
  SUPABASE_SQL_SCHEMA,
  getSupabaseClient,
} from '../lib/supabase';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated: () => void;
  tableMissingWarning?: boolean;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated,
  tableMissingWarning,
}) => {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'credentials' | 'sql'>(
    tableMissingWarning ? 'sql' : 'credentials'
  );
  const [testStatus, setTestStatus] = useState<{
    type: 'idle' | 'testing' | 'success' | 'warning' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });

  if (!isOpen) return null;

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    const trimmedKey = anonKey.trim();

    if (!trimmedUrl || !trimmedKey) {
      setTestStatus({
        type: 'error',
        message: 'Please provide both your Supabase Project URL and Anon Public Key.',
      });
      return;
    }

    if (!trimmedUrl.startsWith('https://')) {
      setTestStatus({
        type: 'error',
        message: 'Supabase URL must start with https:// (e.g., https://xyz.supabase.co)',
      });
      return;
    }

    setTestStatus({ type: 'testing', message: 'Connecting to Supabase...' });
    saveSupabaseConfigToLocal(trimmedUrl, trimmedKey);

    const client = getSupabaseClient();
    if (!client) {
      setTestStatus({
        type: 'error',
        message: 'Could not initialize Supabase client. Check your URL format.',
      });
      return;
    }

    try {
      const { error } = await client.from('notes').select('id').limit(1);
      if (error) {
        if (
          error.code === '42P01' ||
          error.message.toLowerCase().includes('does not exist') ||
          error.message.toLowerCase().includes('schema cache')
        ) {
          setTestStatus({
            type: 'warning',
            message:
              'Connected to Supabase! However, the "notes" table does not exist yet. Switch to the "2. SQL Schema" tab to create it.',
          });
          setActiveTab('sql');
        } else {
          setTestStatus({
            type: 'warning',
            message: `Credentials saved! Note check returned: ${error.message}`,
          });
        }
      } else {
        setTestStatus({
          type: 'success',
          message: 'Connected to Supabase & verified the "notes" table is ready!',
        });
      }
      onConfigUpdated();
    } catch (err) {
      setTestStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to connect to Supabase.',
      });
    }
  };

  const handleClearCredentials = () => {
    clearLocalSupabaseConfig();
    setUrl('');
    setAnonKey('');
    setTestStatus({
      type: 'idle',
      message: 'Cleared browser-stored credentials.',
    });
    onConfigUpdated();
  };

  const handleCopySql = async () => {
    await navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="icon-badge emerald">
              <Database size={18} />
            </div>
            <div>
              <h3>Supabase Database Setup</h3>
              <p className="modal-subtitle">
                Connect your Supabase project to persist your dated notes & reviews
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab ${activeTab === 'credentials' ? 'active' : ''}`}
            onClick={() => setActiveTab('credentials')}
          >
            <Key size={14} />
            1. Project Credentials
          </button>
          <button
            type="button"
            className={`modal-tab ${activeTab === 'sql' ? 'active' : ''}`}
            onClick={() => setActiveTab('sql')}
          >
            <Database size={14} />
            2. SQL Schema
            {tableMissingWarning && <span className="tab-dot" />}
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'credentials' && (
            <form onSubmit={handleSaveAndTest} className="setup-form">
              <div className="info-banner">
                <AlertCircle size={16} />
                <div>
                  Paste your Supabase Project URL and Anon Key below, or place them in{' '}
                  <code>.env</code> as <code>VITE_SUPABASE_URL</code> and{' '}
                  <code>VITE_SUPABASE_ANON_KEY</code>.
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="supabase-url">Supabase Project URL</label>
                <input
                  id="supabase-url"
                  type="url"
                  placeholder="https://your-project-id.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="text-input mono"
                />
              </div>

              <div className="form-group">
                <label htmlFor="supabase-anon-key">Supabase Anon / Public Key</label>
                <input
                  id="supabase-anon-key"
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  className="text-input mono"
                />
              </div>

              {testStatus.type !== 'idle' && (
                <div className={`status-alert ${testStatus.type}`}>
                  {testStatus.type === 'testing' && <RefreshCw size={16} className="spin" />}
                  {testStatus.type === 'success' && <CheckCircle2 size={16} />}
                  {(testStatus.type === 'warning' || testStatus.type === 'error') && (
                    <AlertCircle size={16} />
                  )}
                  <span>{testStatus.message}</span>
                </div>
              )}

              <div className="modal-actions">
                {currentConfig.source === 'local' && (
                  <button
                    type="button"
                    className="btn btn-ghost danger"
                    onClick={handleClearCredentials}
                  >
                    <Trash2 size={15} />
                    Clear Saved Keys
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} />
                  Save & Verify Connection
                </button>
              </div>
            </form>
          )}

          {activeTab === 'sql' && (
            <div className="sql-tab-content">
              <p className="helper-text">
                Copy and run this SQL script inside your{' '}
                <strong>Supabase Dashboard → SQL Editor → New Query</strong> to create the{' '}
                <code>notes</code> table:
              </p>
              <div className="code-block-wrapper">
                <button type="button" className="btn btn-secondary copy-btn" onClick={handleCopySql}>
                  {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                  {copiedSql ? 'Copied SQL!' : 'Copy SQL Script'}
                </button>
                <pre className="sql-pre">
                  <code>{SUPABASE_SQL_SCHEMA}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
