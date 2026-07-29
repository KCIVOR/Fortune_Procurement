'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchUserProfile } from '@/lib/profile';
import { Eye, EyeOff, Lock, Mail, CircleAlert as AlertCircle } from 'lucide-react';
import LightmodeLogo from '@/logo/lightmode_logo.png';

// Import ProcureIQ v2.0 UI components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DEV_PASSWORD = 'Fortune2026!';

const DEV_ACCOUNTS = [
  { email: 'admin@fortune.com',            role: 'Admin',        color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { email: 'ubeeeyk@gmail.com',            role: 'TSQA',         color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { email: 'employee@fortune.com',         role: 'Employee',     color: 'bg-pq-neutral-100 text-pq-neutral-700 border-pq-neutral-200' },
  { email: 'planning@fortune.com',         role: 'Planning',     color: 'bg-pq-neutral-100 text-pq-neutral-700 border-pq-neutral-200' },
  { email: 'planning.head@fortune.com',    role: 'Planning Head', color: 'bg-pq-primary-100 text-pq-primary-700 border-pq-primary-200' },
  { email: 'procurement@fortune.com',      role: 'Procurement',  color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { email: 'proc.manager@fortune.com',     role: 'Proc. Mgr',   color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { email: 'warehouse@fortune.com',        role: 'Warehouse',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { email: 'director@fortune.com',         role: 'Director',     color: 'bg-pq-primary-100 text-pq-primary-700 border-pq-primary-200' },
  { email: 'operations.manager@fortune.com', role: 'Ops Manager', color: 'bg-pq-primary-100 text-pq-primary-700 border-pq-primary-200' },
  { email: 'dept.head@fortune.com',        role: 'Dept. Head',   color: 'bg-pq-primary-100 text-pq-primary-700 border-pq-primary-200' },
  { email: 'supervisor@fortune.com',       role: 'Supervisor',   color: 'bg-pq-primary-100 text-pq-primary-700 border-pq-primary-200' },
  { email: 'finance.director@fortune.com', role: 'Finance Dir.', color: 'bg-pq-primary-100 text-pq-primary-700 border-pq-primary-200' },
  { email: 'supplier@fortune.com',         role: 'Supplier 1',   color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { email: 'supplier2@fortune.com',        role: 'Supplier 2',   color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { email: 'supplier3@fortune.com',        role: 'Supplier 3',   color: 'bg-orange-100 text-orange-700 border-orange-200' },
] as const;

const DEACTIVATED_LOGIN_MESSAGE =
  'This account has been deactivated. Contact your administrator.';
const GENERIC_LOGIN_MESSAGE = 'Invalid email or password. Please try again.';

function isBannedAuthError(error: { message?: string; code?: string }): boolean {
  const code = (error.code ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();
  return code === 'user_banned' || message.includes('banned');
}

async function isDeactivatedAccount(email: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/account-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const json = (await res.json().catch(() => ({}))) as { deactivated?: boolean };
    return json.deactivated === true;
  } catch {
    return false;
  }
}

function QuickLoginPanel({ onLogin }: { onLogin: (email: string) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleClick = async (email: string) => {
    setBusy(email);
    await onLogin(email).finally(() => setBusy(null));
  };

  return (
    <div className="border border-dashed border-pq-neutral-300 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-800 hover:bg-pq-neutral-50 transition"
      >
        <span>Dev Quick Login</span>
        <span className="text-pq-neutral-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-1.5 border-t border-dashed border-pq-neutral-200 bg-pq-neutral-50/60">
          {DEV_ACCOUNTS.map(acc => (
            <button
              key={acc.email}
              type="button"
              disabled={busy !== null}
              onClick={() => handleClick(acc.email)}
              className={`flex flex-col items-start px-2.5 py-2 rounded-md border text-left transition hover:opacity-80 disabled:opacity-40 ${acc.color}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide leading-none">
                {busy === acc.email ? 'Signing in…' : acc.role}
              </span>
              <span className="text-[9px] opacity-70 mt-0.5 truncate w-full">{acc.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get('reset') === 'success';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const quickLogin = async (quickEmail: string) => {
    setError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email: quickEmail, password: DEV_PASSWORD });
    if (error) { setError(GENERIC_LOGIN_MESSAGE); return; }
    localStorage.setItem('rememberMe', 'true');
    const userId = data.user?.id;
    if (userId) {
      const profile = await fetchUserProfile(userId);
      router.push(profile?.role === 'tsqa' ? '/tsqa' : '/dashboard');
    } else {
      router.push('/dashboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const deactivated =
        isBannedAuthError(error) || (await isDeactivatedAccount(email));
      setError(deactivated ? DEACTIVATED_LOGIN_MESSAGE : GENERIC_LOGIN_MESSAGE);
      setLoading(false);
      return;
    }

    // Store remember me preference for session management
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('rememberMe');
      // Mark session as temporary (will be cleared on browser close)
      sessionStorage.setItem('tempSession', 'true');
    }

    const userId = data.user?.id;
    if (userId) {
      const profile = await fetchUserProfile(userId);
      if (profile && profile.active === false) {
        await supabase.auth.signOut();
        setError(DEACTIVATED_LOGIN_MESSAGE);
        setLoading(false);
        return;
      }
      router.push(profile?.role === 'tsqa' ? '/tsqa' : '/dashboard');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-pq-neutral-100">
      <div className="w-full max-w-[420px] space-y-6">
        
        {/* Logo and Header Block */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-20 flex items-center justify-center">
            <Image
              src={LightmodeLogo}
              alt="Fortune Procurement Logo"
              className="w-full h-auto object-contain"
              priority
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-pq-neutral-900 tracking-tight">
              Sign In
            </h1>
          </div>
        </div>

        {/* Primary Login Card */}
        <Card className="border-pq-neutral-200 bg-pq-white shadow-md">
          <CardHeader className="pb-4 space-y-1">
            <CardTitle className="text-lg font-medium text-pq-neutral-900">Welcome Back</CardTitle>
            <CardDescription className="text-xs text-pq-neutral-500">
              Please enter your credentials below to access your account.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Error messages */}
              {error && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertCircle className="w-4 h-4 text-pq-danger-600" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              {resetSuccess && (
                <Alert className="bg-pq-success-50 border-pq-success-200 text-pq-success-900 py-2.5">
                  <AlertDescription className="text-xs">
                    Your password was updated. Sign in with your new password.
                  </AlertDescription>
                </Alert>
              )}

              {/* Email field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-pq-neutral-900">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pq-neutral-400" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@fortune.com"
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-pq-neutral-900">
                    Password
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-pq-primary-600 hover:text-pq-primary-700 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pq-neutral-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-pq-neutral-400 hover:text-pq-neutral-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pq-primary-500/25 rounded"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me toggle */}
              <div className="flex items-center space-x-2 py-0.5">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(!!checked)}
                  className="border-pq-neutral-300 data-[state=checked]:bg-pq-primary-600 data-[state=checked]:border-pq-primary-600"
                />
                <Label
                  htmlFor="remember"
                  className="text-xs font-normal text-pq-neutral-500 cursor-pointer select-none leading-none"
                >
                  Remember this device for 30 days
                </Label>
              </div>

              {/* Submit CTA */}
              <Button type="submit" className="w-full h-10 mt-2 font-medium" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </Button>

            </form>
          </CardContent>
        </Card>

        {/* Dev quick-login shortcuts — dev only */}
        {process.env.NODE_ENV === 'development' && (
          <QuickLoginPanel onLogin={quickLogin} />
        )}

        {/* Minimal Accessible Footer */}
        <div className="text-center text-xs text-pq-neutral-400 flex items-center justify-center gap-3 py-2">
          <span>&copy; 2026 Fortune Procurement Inc.</span>
          <span>&middot;</span>
          <Link href="/bugtrack" className="hover:text-pq-neutral-900 transition">
            Developer Console
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-pq-neutral-500 bg-pq-neutral-100">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
