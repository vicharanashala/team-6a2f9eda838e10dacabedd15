'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { auth, googleProvider, signInWithPopup, GoogleAuthProvider, isFirebaseConfigured } from '@/lib/firebase';

function AuthPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, login, loginWithGoogle, register } = useAuth();
  const [mode, setMode] = useState(searchParams.get('mode') || 'login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    router.push('/');
    return null;
  }

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured) {
      const email = prompt('Google Sign-in is not configured. Enter an email to perform a simulated Google Sign-in:', 'google-user@example.com');
      if (!email) return;
      setError('');
      setLoading(true);
      try {
        await loginWithGoogle(`mock_google_token_${email}`);
        router.push('/');
      } catch (err) {
        setError(err.message || 'Simulated Google Sign-in failed');
        toast.error(err.message || 'Simulated Google Sign-in failed');
      } finally {
        setLoading(false);
      }
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      if (!idToken) {
        throw new Error('Could not retrieve Google ID token.');
      }
      await loginWithGoogle(idToken);
      router.push('/');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/network-request-failed' || err.message?.includes('network-request-failed')) {
        const email = prompt('Google Sign-in encountered a network error. Enter an email to perform a simulated Google Sign-in:', 'google-user@example.com');
        if (email) {
          try {
            await loginWithGoogle(`mock_google_token_${email}`);
            router.push('/');
            return;
          } catch (mockErr) {
            setError(mockErr.message || 'Simulated Google Sign-in failed');
            toast.error(mockErr.message || 'Simulated Google Sign-in failed');
          }
        }
      }
      setError(err.message || 'Google Sign-in failed');
      toast.error(err.message || 'Google Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.username, form.email, form.password);
      }
      router.push('/');
    } catch (err) {
      setError(err.message || 'Something went wrong');
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card-elevated p-8 animate-scale-in">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-purple-500 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">
              {mode === 'login' ? 'Welcome back' : 'Join the community'}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-2">
              {mode === 'login' ? 'Sign in to your account to continue' : 'Create your account and start exploring'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-500">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[var(--color-border)]/60 hover:bg-[var(--color-bg-tertiary)] rounded-xl font-medium text-sm text-[var(--color-text)] transition-colors mb-6 shadow-sm disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.53-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-8.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.08 1.16-3.14 0-5.8-2.11-6.75-4.96H1.31v3.15C3.29 22.35 7.39 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.25 14.24A7.18 7.18 0 014.9 12c0-.79.13-1.57.35-2.31V6.54H1.31A11.99 11.99 0 000 12c0 1.92.45 3.74 1.25 5.37l3.9-3.03-.09-.1z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.39 0 3.29 1.65 1.31 5.37l3.94 3.03c.95-2.85 3.61-4.96 6.75-4.96z"
              />
            </svg>
            Sign in with Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-border)]/60"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--color-bg-secondary)] px-2 text-[var(--color-text-muted)]">
                Or continue with
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div>
                <label className="label">Username</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="input"
                  placeholder="your_username"
                />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
                placeholder="At least 6 characters"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button onClick={() => setMode('signup')} className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-semibold transition-colors">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={() => setMode('login')} className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-semibold transition-colors">
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center animate-pulse"><div className="h-8 w-48 bg-[var(--color-border)] rounded" /></div>}>
      <AuthPageContent />
    </Suspense>
  );
}