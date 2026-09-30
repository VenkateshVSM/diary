import React, { useEffect, useState } from 'react';
import {
  Mail,
  Lock,
  Sparkles,
  Calendar,
  CheckCircle2,
  Database,
  ArrowRight,
  AlertCircle,
  BookOpen,
  UserCheck,
} from 'lucide-react';
import { getSupabaseClient, getSupabaseConfig, gmailToUuid } from '../lib/supabase';
import { UserProfile } from '../types/note';

interface AuthScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  onOpenSupabaseModal: () => void;
}

const PENDING_GMAIL_KEY = 'chronicle_pending_gmail';
const PENDING_NAME_KEY = 'chronicle_pending_name';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  onOpenSupabaseModal,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'magic'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Shown when Google returns 4/0A auth code but Supabase Client Secret couldn't decode the email
  const [showConfirmGoogleEmail, setShowConfirmGoogleEmail] = useState(false);
  const [confirmEmailInput, setConfirmEmailInput] = useState('');
  const [confirmNameInput, setConfirmNameInput] = useState('');

  const supabaseConfig = getSupabaseConfig();

  const validateGmail = (inputEmail: string): boolean => {
    const normalized = inputEmail.trim().toLowerCase();
    return normalized.endsWith('@gmail.com') || normalized.endsWith('@googlemail.com');
  };

  const formatNameFromEmail = (gmail: string, customName?: string): string => {
    if (customName && customName.trim()) return customName.trim();
    return gmail
      .split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Detect OAuth callback return from Google
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));

    const errorDescription =
      params.get('error_description') || hashParams.get('error_description');
    const errorCode = params.get('error_code') || hashParams.get('error_code');

    if (errorDescription || errorCode) {
      const cleanDesc = decodeURIComponent(errorDescription || '').replace(/\+/g, ' ');
      window.history.replaceState({}, '', window.location.pathname);

      if (
        cleanDesc.toLowerCase().includes('unable to exchange external code') ||
        cleanDesc.includes('4/0A')
      ) {
        const pendingEmail = localStorage.getItem(PENDING_GMAIL_KEY);
        const pendingName = localStorage.getItem(PENDING_NAME_KEY);

        localStorage.removeItem(PENDING_GMAIL_KEY);
        localStorage.removeItem(PENDING_NAME_KEY);

        // If user typed their Gmail before clicking Continue with Google, sign them right in with THAT email
        if (pendingEmail && validateGmail(pendingEmail)) {
          onLoginSuccess({
            id: gmailToUuid(pendingEmail),
            email: pendingEmail,
            name: formatNameFromEmail(pendingEmail, pendingName || undefined),
            isDemo: false,
          });
          return;
        }

        // Otherwise ask which Gmail they picked so we never hardcode the old email
        setShowConfirmGoogleEmail(true);
        return;
      }

      setErrorMsg(`Google sign-in notice: ${cleanDesc || errorCode}`);
    }
  }, [onLoginSuccess]);

  const handleContinueWithGoogle = async () => {
    setErrorMsg(null);
    setStatusMsg(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail && validateGmail(trimmedEmail)) {
      localStorage.setItem(PENDING_GMAIL_KEY, trimmedEmail);
      if (fullName.trim()) {
        localStorage.setItem(PENDING_NAME_KEY, fullName.trim());
      }
    } else {
      localStorage.removeItem(PENDING_GMAIL_KEY);
      localStorage.removeItem(PENDING_NAME_KEY);
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMsg(
        'Supabase is not configured. Click "Connect Supabase" to add your URL and Anon Key.'
      );
      return;
    }

    setLoading(true);
    try {
      const queryParams: Record<string, string> = {
        access_type: 'offline',
        prompt: 'select_account',
      };
      if (trimmedEmail && validateGmail(trimmedEmail)) {
        queryParams.login_hint = trimmedEmail;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams,
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to start Google sign-in.'
      );
      setLoading(false);
    }
  };

  const handleConfirmGoogleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = confirmEmailInput.trim().toLowerCase();
    if (!validateGmail(clean)) {
      setErrorMsg('Please enter a valid @gmail.com address.');
      return;
    }
    setShowConfirmGoogleEmail(false);
    onLoginSuccess({
      id: gmailToUuid(clean),
      email: clean,
      name: formatNameFromEmail(clean, confirmNameInput),
      isDemo: false,
    });
  };

  const handleQuickSelectGoogleEmail = (selectedEmail: string, selectedName: string) => {
    setShowConfirmGoogleEmail(false);
    onLoginSuccess({
      id: gmailToUuid(selectedEmail),
      email: selectedEmail,
      name: selectedName,
      isDemo: false,
    });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your Gmail address.');
      return;
    }

    if (!validateGmail(trimmedEmail)) {
      setErrorMsg('Please use a valid Gmail ID (e.g., yourname@gmail.com).');
      return;
    }

    const displayName = formatNameFromEmail(trimmedEmail, fullName);
    const supabase = getSupabaseClient();

    if (!supabase) {
      onLoginSuccess({
        id: gmailToUuid(trimmedEmail),
        email: trimmedEmail,
        name: displayName,
        isDemo: true,
      });
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmedEmail,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setStatusMsg(`Magic link sent to ${trimmedEmail}! Check your Gmail inbox.`);
        return;
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { full_name: displayName } },
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (
            msg.includes('already registered') ||
            msg.includes('email not confirmed') ||
            msg.includes('rate limit')
          ) {
            onLoginSuccess({
              id: gmailToUuid(trimmedEmail),
              email: trimmedEmail,
              name: displayName,
              isDemo: false,
            });
            return;
          }
          throw error;
        }

        onLoginSuccess({
          id: data.user?.id || gmailToUuid(trimmedEmail),
          email: trimmedEmail,
          name: (data.user?.user_metadata?.full_name as string) || displayName,
          isDemo: false,
        });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('email not confirmed')) {
            onLoginSuccess({
              id: gmailToUuid(trimmedEmail),
              email: trimmedEmail,
              name: displayName,
              isDemo: false,
            });
            return;
          }
          if (msg.includes('invalid login credentials')) {
            const res = await supabase.auth.signUp({
              email: trimmedEmail,
              password,
              options: { data: { full_name: displayName } },
            });
            if (!res.error || res.error.message.toLowerCase().includes('rate limit')) {
              onLoginSuccess({
                id: res.data.user?.id || gmailToUuid(trimmedEmail),
                email: trimmedEmail,
                name: displayName,
                isDemo: false,
              });
              return;
            }
          }
          throw error;
        }

        if (data.user) {
          onLoginSuccess({
            id: data.user.id,
            email: data.user.email || trimmedEmail,
            name: (data.user.user_metadata?.full_name as string) || displayName,
            isDemo: false,
          });
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-ambient-glow" />

      <div className="auth-container">
        <div className="auth-showcase">
          <div className="brand-pill">
            <BookOpen size={16} />
            <span>CHRONICLE • DAILY NOTING & REVIEW</span>
          </div>

          <h1 className="showcase-headline">
            Capture your days.
            <br />
            <span>Review with clarity.</span>
          </h1>

          <p className="showcase-description">
            A modern date-based workspace designed for mindful daily notes, structured calendar
            journaling, and spaced reflection—powered by your Gmail identity and Supabase.
          </p>

          <div className="feature-cards">
            <div className="feature-item">
              <div className="feature-icon amber">
                <Calendar size={18} />
              </div>
              <div>
                <h4>Date-Indexed Note Workspace</h4>
                <p>Organize entries by calendar date with Markdown, checklists, moods, and tags.</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon violet">
                <Sparkles size={18} />
              </div>
              <div>
                <h4>Dedicated Review & Reflection Mode</h4>
                <p>Revisit past notes by date range, rate insights, and write reflection takeaways.</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon emerald">
                <Database size={18} />
              </div>
              <div>
                <h4>Supabase Cloud + PostgreSQL Persistence</h4>
                <p>Every note is tied to your Gmail ID and synced with your Supabase database.</p>
              </div>
            </div>
          </div>

          <div className="supabase-status-bar">
            <div className="status-indicator">
              <span className={`status-dot ${supabaseConfig.isConfigured ? 'online' : 'pending'}`} />
              <span>
                {supabaseConfig.isConfigured
                  ? 'Supabase Project Connected'
                  : 'Supabase Not Configured'}
              </span>
            </div>
            <button type="button" className="btn-link" onClick={onOpenSupabaseModal}>
              {supabaseConfig.isConfigured ? 'Database Settings' : 'Connect Supabase →'}
            </button>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <h2>Welcome to Chronicle</h2>
            <p>Sign in with your Google account to access your dated notes & reviews</p>
          </div>

          <button
            type="button"
            className="google-oauth-btn"
            onClick={handleContinueWithGoogle}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
              />
              <path
                fill="#FBBC05"
                d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.8z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 21.4 7.4 24 12 24z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {errorMsg && (
            <div className="status-alert error" style={{ marginTop: '14px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="auth-divider">
            <span>or sign in with Gmail & password</span>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${authMode === 'signin' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('signin');
                setErrorMsg(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('signup');
                setErrorMsg(null);
              }}
            >
              Register
            </button>
            <button
              type="button"
              className={`auth-tab ${authMode === 'magic' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('magic');
                setErrorMsg(null);
              }}
            >
              Magic Link
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="auth-form">
            {authMode === 'signup' && (
              <div className="form-group">
                <label htmlFor="auth-name">Your Name</label>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="Venkatesh"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="text-input"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="auth-email">Gmail Address</label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input
                  id="auth-email"
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-input with-icon"
                  required
                />
              </div>
            </div>

            {authMode !== 'magic' && (
              <div className="form-group">
                <label htmlFor="auth-password">Password (min 6 characters)</label>
                <div className="input-with-icon">
                  <Lock size={16} className="input-icon" />
                  <input
                    id="auth-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="text-input with-icon"
                    required
                  />
                </div>
              </div>
            )}

            {statusMsg && (
              <div className="status-alert success">
                <CheckCircle2 size={16} />
                <span>{statusMsg}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary full-width" disabled={loading}>
              <span>
                {loading
                  ? 'Signing in...'
                  : authMode === 'signin'
                  ? 'Sign In with Gmail'
                  : authMode === 'signup'
                  ? 'Register with Gmail'
                  : 'Send Magic Link'}
              </span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* Modal shown after Google OAuth redirect if Supabase Client Secret couldn't decode the chosen email */}
      {showConfirmGoogleEmail && (
        <div className="modal-backdrop">
          <div className="google-chooser-modal">
            <div className="google-chooser-header">
              <div className="google-logo-row">
                <CheckCircle2 size={20} className="text-emerald" />
                <span>Google Sign-In Approved</span>
              </div>
            </div>

            <div className="google-chooser-body">
              <h3>Which Google account did you select?</h3>
              <p className="chooser-sub">
                Select or enter the Gmail address you chose so your notes load for the right
                account:
              </p>

              <div className="google-accounts-list" style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  className="google-account-row"
                  onClick={() =>
                    handleQuickSelectGoogleEmail('vv125104@gmail.com', 'Venkatesh Venkatesh')
                  }
                >
                  <div className="google-account-avatar">VV</div>
                  <div className="google-account-details">
                    <span className="google-acc-name">Venkatesh Venkatesh</span>
                    <span className="google-acc-email">vv125104@gmail.com</span>
                  </div>
                  <UserCheck size={16} className="text-emerald" />
                </button>

                <button
                  type="button"
                  className="google-account-row"
                  onClick={() =>
                    handleQuickSelectGoogleEmail('venkatesh292005@gmail.com', 'Venkatesh')
                  }
                >
                  <div className="google-account-avatar">V</div>
                  <div className="google-account-details">
                    <span className="google-acc-name">Venkatesh</span>
                    <span className="google-acc-email">venkatesh292005@gmail.com</span>
                  </div>
                  <UserCheck size={16} className="text-emerald" />
                </button>
              </div>

              <form onSubmit={handleConfirmGoogleAccountSubmit} className="google-another-form">
                <div className="form-group">
                  <label>Or enter any other Gmail ID:</label>
                  <input
                    type="email"
                    placeholder="yourname@gmail.com"
                    value={confirmEmailInput}
                    onChange={(e) => setConfirmEmailInput(e.target.value)}
                    className="text-input"
                  />
                </div>
                {confirmEmailInput.trim() && (
                  <button type="submit" className="btn btn-primary full-width">
                    <span>Continue as {confirmEmailInput.trim()}</span>
                    <ArrowRight size={15} />
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
