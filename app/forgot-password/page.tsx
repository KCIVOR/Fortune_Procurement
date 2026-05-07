'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Mail } from 'lucide-react';
import LightmodeLogo from '@/logo/lightmode_logo.png';

function getRedirectOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

/**
 * Password reset request. Uses same redirect origin the user is browsing (works with localhost and prod).
 *
 * Supabase Dashboard → Authentication → URL configuration:
 * - Add {origin}/reset-password to Redirect URLs (and production URL).
 * - Customize "Reset password" email template for Fortune Procurement branding.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const origin = getRedirectOrigin();
    const redirectTo = `${origin}/reset-password`;

    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-white lg:bg-gradient-to-br lg:from-[#F7F9FC] lg:to-white flex flex-col justify-center px-4 py-10">
      <div className="w-full max-w-[400px] mx-auto">
        <div className="flex justify-center mb-6">
          <div className="w-24">
            <Image src={LightmodeLogo} alt="Fortune Procurement" className="w-full h-auto" priority />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-[#0F1F3A] text-center mb-1">Forgot password</h1>
        <p className="text-sm text-[#40527A] text-center mb-8">
          Enter your work email. If an account exists for this address, a reset link will be sent.
        </p>

        <div className="bg-white rounded-lg border border-[#E5EAFF] p-6 shadow-sm">
          {submitted ? (
            <div className="flex gap-2 bg-[#F0F9FF] border border-[#BAE6FD] text-[#0369A1] text-sm rounded-lg px-4 py-3">
              <span>
                If an account exists for this email, a reset link has been sent. Check your inbox
                and spam folder.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-[#0F1F3A]">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#BFC7D5]" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#D8E2FF] bg-[#F7F9FC] text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#1E4BFF] hover:bg-[#0F1F3A] disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
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
