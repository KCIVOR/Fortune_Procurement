'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { establishSessionFromAuthRedirect } from '@/lib/auth-email-link-session';
import { Eye, EyeOff, Lock, CircleAlert as AlertCircle } from 'lucide-react';
import LightmodeLogo from '@/logo/lightmode_logo.png';

const MIN_PASSWORD_LENGTH = 8;

/**
 * User lands here from Supabase password recovery email.
 * Dashboard: allow {origin}/reset-password in Redirect URLs.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok, errorMessage } = await establishSessionFromAuthRedirect(supabase);
      if (cancelled) return;
      if (!ok) {
        setLinkError(errorMessage ?? 'Unable to verify reset link.');
        return;
      }
      setSessionReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFormError(error.message);
        return;
      }
      await supabase.auth.signOut();
      router.push('/login?reset=success');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (linkError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-pq-neutral-50">
        <div className="w-full max-w-md bg-white border border-pq-neutral-200 rounded-lg p-8 shadow-sm text-center">
          <AlertCircle className="w-10 h-10 text-pq-warning-600 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-pq-neutral-900 mb-2">Reset link issue</h1>
          <p className="text-sm text-pq-neutral-500 mb-6">{linkError}</p>
          <Link href="/forgot-password" className="text-sm font-medium text-pq-primary-600 hover:underline">
            Request a new reset link
          </Link>
          <p className="text-xs text-pq-neutral-500 mt-4">
            <Link href="/login" className="text-pq-primary-600 hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-pq-neutral-50">
        <p className="text-sm text-pq-neutral-500">Verifying your reset link…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white lg:bg-gradient-to-br lg:from-[#F7F9FC] lg:to-white flex flex-col justify-center px-4 py-10">
      <div className="w-full max-w-[400px] mx-auto">
        <div className="flex justify-center mb-6">
          <div className="w-24">
            <Image src={LightmodeLogo} alt="Fortune Procurement" className="w-full h-auto" priority />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-pq-neutral-900 text-center mb-1">Set a new password</h1>
        <p className="text-sm text-pq-neutral-500 text-center mb-8">Choose a strong password for your account.</p>

        <div className="bg-white rounded-lg border border-pq-neutral-200 p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {formError && (
              <div className="flex gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="npw" className="block text-sm font-medium text-pq-neutral-900">
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pq-neutral-400" />
                <input
                  id="npw"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-pq-neutral-200 bg-pq-neutral-50 text-sm"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pq-neutral-400 hover:text-pq-neutral-500"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="nconfirm" className="block text-sm font-medium text-pq-neutral-900">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pq-neutral-400" />
                <input
                  id="nconfirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-pq-neutral-200 bg-pq-neutral-50 text-sm"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pq-neutral-400 hover:text-pq-neutral-500"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-pq-primary-600 hover:bg-pq-neutral-900 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-pq-neutral-500 mt-6">
          <Link href="/login" className="text-pq-primary-600 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
