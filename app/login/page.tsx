'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchUserProfile } from '@/lib/profile';
import { Eye, EyeOff, Lock, Mail, CircleAlert as AlertCircle } from 'lucide-react';
import LightmodeLogo from '@/logo/lightmode_logo.png';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Invalid email or password. Please try again.');
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const profile = await fetchUserProfile(userId);
      router.push(profile?.role === 'tsqa' ? '/tsqa' : '/dashboard');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-white lg:bg-gradient-to-br lg:from-[#F7F9FC] lg:to-white">
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
        {/* Left Brand Panel - Hidden on Mobile */}
        <div className="hidden lg:flex bg-gradient-to-br from-[#0F1F3A] via-[#1E2F4A] to-[#0F1F3A]" />


        {/* Right Login Panel */}
        <div className="flex flex-col justify-center px-4 py-8 lg:py-0 lg:px-8">
          <div className="w-full max-w-[400px] mx-auto">
            {/* Logo */}
            <div className="flex items-center justify-center mb-6">
              <div className="w-24 max-w-full flex items-center justify-center">
                <Image
                  src={LightmodeLogo}
                  alt="Fortune Procurement"
                  className="w-full h-auto object-contain"
                  priority
                />
              </div>
            </div>

            {/* Welcome Section */}
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-[#0F1F3A] tracking-tight">
                Welcome back
              </h1>
              <p className="text-[#40527A] mt-2 text-sm leading-relaxed">
                Sign in to continue to Fortune Procurement
              </p>
            </div>

            {/* Login Form Card */}
            <div className="bg-white rounded-lg border border-[#E5EAFF] p-6 lg:p-7 shadow-sm lg:shadow-md mb-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-[#0F1F3A]">
                    Email address
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
                      placeholder="you@fortune.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#D8E2FF] bg-[#F7F9FC] text-[#0F1F3A] text-sm placeholder:text-[#BFC7D5] focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-[#0F1F3A]">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#BFC7D5]" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-[#D8E2FF] bg-[#F7F9FC] text-[#0F1F3A] text-sm placeholder:text-[#BFC7D5] focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#BFC7D5] hover:text-[#40527A] transition"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-[#1E4BFF] hover:bg-[#0F1F3A] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:ring-offset-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>
            </div>

            {/* Demo credentials hint */}
            <div className="bg-[#F7F9FC] border border-[#E5EAFF] rounded-lg p-5 space-y-3">
              <p className="text-xs font-semibold text-[#0F1F3A] uppercase tracking-wide">Demo Accounts</p>

              {/* Admin */}
              <div>
                <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-2">Administration</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {[
                    ['admin@fortune.com', 'Admin'],
                  ].map(([email, label]) => (
                    <button
                      key={email}
                      type="button"
                      onClick={() => { setEmail(email); setPassword('Fortune2024!'); }}
                      className="text-left text-xs text-[#1E4BFF] hover:text-[#0F1F3A] transition truncate hover:underline"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* PO Approval flow */}
              <div>
                <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-2">PO Approval Flow</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {[
                    ['buyer@fortune.com',           'Buyer'],
                    ['proc.manager@fortune.com',    'Proc. Manager'],
                    ['finance.director@fortune.com','Finance Dir.'],
                    ['supplier@fortune.com',        'Supplier'],
                  ].map(([email, label]) => (
                    <button
                      key={email}
                      type="button"
                      onClick={() => { setEmail(email); setPassword('Fortune2024!'); }}
                      className="text-left text-xs text-[#1E4BFF] hover:text-[#0F1F3A] transition truncate hover:underline"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Other roles */}
              <div>
                <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-2">Other Roles</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {[
                    ['employee@fortune.com',   'Employee'],
                    ['warehouse@fortune.com',  'Warehouse'],
                    ['wh.manager@fortune.com', 'WH Manager'],
                    ['procurement@fortune.com','Procurement'],
                    ['supervisor@fortune.com', 'Supervisor'],
                    ['dept.head@fortune.com',  'Dept Head'],
                    ['director@fortune.com',   'Director'],
                  ].map(([email, label]) => (
                    <button
                      key={email}
                      type="button"
                      onClick={() => { setEmail(email); setPassword('Fortune2024!'); }}
                      className="text-left text-xs text-[#1E4BFF] hover:text-[#0F1F3A] transition truncate hover:underline"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-[#40527A] pt-2 border-t border-[#D8E2FF]">
                Password: <span className="font-mono font-semibold">Fortune2024!</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
