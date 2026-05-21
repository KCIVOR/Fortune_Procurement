'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchUserProfile } from '@/lib/profile';
import { Eye, EyeOff, Lock, Mail, CircleAlert as AlertCircle, ShieldCheck } from 'lucide-react';
import LightmodeLogo from '@/logo/lightmode_logo.png';

// Import ProcureIQ v2.0 UI components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

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

        {/* Re-designed Collapsible Developer Demo Accounts section */}
        <Card className="border-pq-neutral-200 bg-pq-white shadow-sm overflow-hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="demo-credentials" className="border-0">
              <AccordionTrigger className="px-5 py-3 hover:no-underline text-xs font-medium text-pq-neutral-500 hover:text-pq-neutral-900 transition flex items-center justify-between [&[data-state=open]]:bg-pq-neutral-50">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-pq-primary-500" />
                  Quick Access Developer Credentials
                </span>
              </AccordionTrigger>
              <AccordionContent className="p-5 pt-3 space-y-4 text-xs bg-pq-neutral-50 border-t border-pq-neutral-100">
                
                {/* Admin */}
                <div>
                  <p className="font-semibold text-pq-neutral-400 uppercase tracking-wider text-[10px] mb-2">Administration</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setEmail('admin@fortune.com'); setPassword('Fortune2024!'); }}
                      className="px-2.5 py-1.5 bg-pq-white border border-pq-neutral-200 text-pq-neutral-700 hover:border-pq-primary-300 hover:text-pq-primary-600 rounded transition text-left truncate font-medium shadow-2xs"
                    >
                      Super Admin
                    </button>
                  </div>
                </div>

                {/* PO Approval flow */}
                <div>
                  <p className="font-semibold text-pq-neutral-400 uppercase tracking-wider text-[10px] mb-2">PO Approval Flow</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['buyer@fortune.com', 'Buyer'],
                      ['proc.manager@fortune.com', 'Proc. Manager'],
                      ['finance.director@fortune.com', 'Finance Dir.'],
                      ['supplier@fortune.com', 'Supplier'],
                    ].map(([email, label]) => (
                      <button
                        key={email}
                        type="button"
                        onClick={() => { setEmail(email); setPassword('Fortune2024!'); }}
                        className="px-2.5 py-1.5 bg-pq-white border border-pq-neutral-200 text-pq-neutral-700 hover:border-pq-primary-300 hover:text-pq-primary-600 rounded transition text-left truncate font-medium shadow-2xs"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Other roles */}
                <div>
                  <p className="font-semibold text-pq-neutral-400 uppercase tracking-wider text-[10px] mb-2">Other Operations</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['employee@fortune.com', 'Employee'],
                      ['warehouse@fortune.com', 'Warehouse'],
                      ['wh.manager@fortune.com', 'WH Manager'],
                      ['procurement@fortune.com', 'Procurement'],
                      ['supervisor@fortune.com', 'Supervisor'],
                      ['dept.head@fortune.com', 'Dept Head'],
                      ['director@fortune.com', 'Director'],
                    ].map(([email, label]) => (
                      <button
                        key={email}
                        type="button"
                        onClick={() => { setEmail(email); setPassword('Fortune2024!'); }}
                        className="px-2.5 py-1.5 bg-pq-white border border-pq-neutral-200 text-pq-neutral-700 hover:border-pq-primary-300 hover:text-pq-primary-600 rounded transition text-left truncate font-medium shadow-2xs"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-pq-neutral-200 flex justify-between items-center text-pq-neutral-500">
                  <span>Standard Password:</span>
                  <code className="px-1.5 py-0.5 bg-pq-white border border-pq-neutral-200 rounded font-mono font-semibold text-pq-neutral-800">
                    Fortune2024!
                  </code>
                </div>

              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>

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
