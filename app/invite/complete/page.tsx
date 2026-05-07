'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { establishSessionFromAuthRedirect } from '@/lib/auth-email-link-session';
import { fetchUserProfile } from '@/lib/profile';
import { Eye, EyeOff, Lock, CircleAlert as AlertCircle } from 'lucide-react';
import LightmodeLogo from '@/logo/lightmode_logo.png';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Invite completion: user arrives from Supabase email (redirectTo must be allowlisted in Dashboard).
 * Dashboard: Auth → URL configuration → add {origin}/invite/complete and localhost variant.
 */
export default function InviteCompletePage() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok, errorMessage } = await establishSessionFromAuthRedirect(supabase);
      if (cancelled) return;
      if (!ok) {
        setLinkError(errorMessage ?? 'Unable to verify invitation link.');
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
    if (!password) {
      setFormError('Please enter a password.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
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
      setDone(true);
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId) {
        const profile = await fetchUserProfile(userId);
        router.push(profile?.role === 'tsqa' ? '/tsqa' : '/dashboard');
        return;
      }
      router.push('/login');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (linkError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#F7F9FC]">
        <div className="w-full max-w-md bg-white border border-[#E5EAFF] rounded-lg p-8 shadow-sm text-center">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-[#0F1F3A] mb-2">Invitation link issue</h1>
          <p className="text-sm text-[#40527A] mb-6">{linkError}</p>
          <Link href="/login" className="text-sm font-medium text-[#1E4BFF] hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#F7F9FC]">
        <p className="text-sm text-[#40527A]">Verifying your invitation…</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#F7F9FC]">
        <p className="text-sm text-[#40527A]">Password saved. Redirecting…</p>
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
        <h1 className="text-2xl font-bold text-[#0F1F3A] text-center mb-1">Set your password</h1>
        <p className="text-sm text-[#40527A] text-center mb-8">
          Complete your Fortune Procurement account setup.
        </p>

        <div className="bg-white rounded-lg border border-[#E5EAFF] p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {formError && (
              <div className="flex gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="pw" className="block text-sm font-medium text-[#0F1F3A]">
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#BFC7D5]" />
                <input
                  id="pw"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-[#D8E2FF] bg-[#F7F9FC] text-sm"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#BFC7D5] hover:text-[#40527A]"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm" className="block text-sm font-medium text-[#0F1F3A]">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#BFC7D5]" />
                <input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-[#D8E2FF] bg-[#F7F9FC] text-sm"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#BFC7D5] hover:text-[#40527A]"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-[#1E4BFF] hover:bg-[#0F1F3A] disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {submitting ? 'Saving…' : 'Save password and continue'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#7A8BA8] mt-6">
          <Link href="/login" className="text-[#1E4BFF] hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
