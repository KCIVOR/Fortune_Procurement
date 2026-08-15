'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/authenticated-fetch';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';

type SmtpPublicView = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  from_email: string;
  from_name: string;
  password_set: boolean;
};

export default function SmtpSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [passwordSet, setPasswordSet] = useState(false);

  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('Fortune Procurement');
  const [testTo, setTestTo] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/admin/smtp-settings');
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to load SMTP settings.');
        }
        const data = json.data as SmtpPublicView;
        if (cancelled) return;
        setHost(data.host);
        setPort(String(data.port ?? 587));
        setSecure(Boolean(data.secure));
        setUsername(data.username);
        setFromEmail(data.from_email);
        setFromName(data.from_name || 'Fortune Procurement');
        setPasswordSet(Boolean(data.password_set));
        setPassword('');
      } catch (err) {
        if (!cancelled) setError((err as Error).message || 'Failed to load SMTP settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSaving(true);
    try {
      const res = await authFetch('/api/admin/smtp-settings', {
        method: 'PUT',
        body: JSON.stringify({
          host,
          port: Number(port),
          secure,
          username,
          password,
          from_email: fromEmail,
          from_name: fromName,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save SMTP settings.');
      }
      const data = json.data as SmtpPublicView;
      setPasswordSet(Boolean(data.password_set));
      setPassword('');
      setSuccessMsg('SMTP settings saved. Connection check passed.');
    } catch (err) {
      setError((err as Error).message || 'Failed to save SMTP settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    setError('');
    setSuccessMsg('');
    setTesting(true);
    try {
      const res = await authFetch('/api/admin/smtp-settings/test', {
        method: 'POST',
        body: JSON.stringify({ to: testTo }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to send test email.');
      }
      setSuccessMsg(`Test email sent to ${testTo.trim()}.`);
    } catch (err) {
      setError((err as Error).message || 'Failed to send test email.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
        <Mail className="w-3.5 h-3.5 text-pq-neutral-400" />
        <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
          SMTP
        </span>
      </div>

      {loading ? (
        <div className="p-4 text-xs text-pq-neutral-400">Loading SMTP settings…</div>
      ) : (
        <form onSubmit={handleSave} className="p-4 space-y-3">
          <p className="text-xs text-pq-neutral-400 leading-relaxed">
            Used to send bug notifications and RFQ invitation emails. Invite and password-reset
            emails are configured separately in Supabase.
          </p>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-pq-neutral-600">Host</label>
            <Input
              value={host}
              onChange={e => setHost(e.target.value)}
              className="h-8 text-xs"
              placeholder="mail.example.com"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-pq-neutral-600">Port</label>
            <Input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={e => setPort(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-pq-neutral-600">
            <input
              type="checkbox"
              checked={secure}
              onChange={e => setSecure(e.target.checked)}
              className="rounded border-pq-neutral-300"
            />
            Secure (SSL / port 465)
          </label>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-pq-neutral-600">Username</label>
            <Input
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="h-8 text-xs"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-pq-neutral-600">Password</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="h-8 text-xs"
              autoComplete="new-password"
              placeholder={passwordSet ? 'Password saved — leave blank to keep' : 'Required'}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-pq-neutral-600">From email</label>
            <Input
              type="email"
              value={fromEmail}
              onChange={e => setFromEmail(e.target.value)}
              className="h-8 text-xs"
              placeholder="no-reply@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-pq-neutral-600">From name</label>
            <Input
              value={fromName}
              onChange={e => setFromName(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-pq-danger-600 bg-pq-danger-50 border border-pq-danger-100 rounded-md px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          {successMsg && (
            <div className="flex items-start gap-2 text-xs text-pq-success-700 bg-pq-success-50 border border-pq-success-100 rounded-md px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {successMsg}
            </div>
          )}

          <Button type="submit" disabled={saving || testing} className="w-full text-xs">
            {saving ? 'Saving…' : 'Save SMTP settings'}
          </Button>

          <div className="pt-2 border-t border-pq-neutral-100 space-y-3">
            <p className="text-xs text-pq-neutral-400 leading-relaxed">
              Send a test message using the saved SMTP settings. Save first if you changed the fields above.
            </p>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-pq-neutral-600">Test recipient</label>
              <Input
                type="email"
                value={testTo}
                onChange={e => setTestTo(e.target.value)}
                className="h-8 text-xs"
                placeholder="you@example.com"
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={testing || saving || !passwordSet || !testTo.trim()}
              onClick={handleSendTest}
              className="w-full text-xs"
            >
              {testing ? 'Sending…' : 'Send test email'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
