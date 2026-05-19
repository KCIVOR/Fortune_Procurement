'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { updateOwnFullName } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { User, Mail, Shield, Briefcase, Building2, Eye, EyeOff, CircleCheck as CheckCircle2, CircleAlert as AlertCircle } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  employee:    'Employee',
  warehouse:   'Warehouse',
  procurement: 'Procurement',
  approver:    'Approver',
  supplier:    'Supplier',
  admin:       'Administrator',
};

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();

  // Name section
  const [fullName, setFullName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState('');

  // Password section
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (profile) setFullName(profile.full_name);
  }, [profile]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !fullName.trim()) return;

    setNameSaving(true);
    setNameError('');
    setNameSuccess(false);

    try {
      await updateOwnFullName(profile.id, fullName.trim());
      await refreshProfile();
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Failed to update name.');
    } finally {
      setNameSaving(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (!currentPassword) {
      setPwError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }

    setPwSaving(true);
    try {
      // Verify current password before allowing the update
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: profile?.email ?? '',
        password: currentPassword,
      });
      if (verifyError) {
        setPwError('Current password is incorrect.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw new Error(updateError.message);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setPwSaving(false);
    }
  }

  const nameChanged = profile && fullName.trim() !== profile.full_name;
  const pwValid = currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  return (
    <AppShell title="My Profile">
      <PageHeader
        title="My Profile"
        description="Manage your display name and account password."
      />

      <div className="max-w-2xl mx-auto space-y-6">

        {/* Section 1: Profile Information */}
        <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50">
            <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Profile Information</h2>
          </div>

          <form onSubmit={handleSaveName} className="p-6 space-y-5">
            {/* Full Name — editable */}
            <div className="space-y-1.5">
              <Label htmlFor="full_name" className="flex items-center gap-1.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                <User className="w-3.5 h-3.5 text-pq-neutral-400" />
                Full Name
              </Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={nameSaving}
                className="text-sm"
                placeholder="Your full name"
              />
            </div>

            {/* Email — read-only */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                <Mail className="w-3.5 h-3.5 text-pq-neutral-400" />
                Email
                <span className="ml-1 text-[10px] font-normal text-pq-neutral-400 normal-case tracking-normal">read-only</span>
              </Label>
              <Input
                value={profile?.email ?? ''}
                readOnly
                disabled
                className="text-sm bg-pq-neutral-50 text-pq-neutral-500 cursor-not-allowed opacity-70"
              />
            </div>

            {/* Role — read-only */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                <Shield className="w-3.5 h-3.5 text-pq-neutral-400" />
                Role
                <span className="ml-1 text-[10px] font-normal text-pq-neutral-400 normal-case tracking-normal">read-only</span>
              </Label>
              <Input
                value={profile?.role ? (ROLE_LABELS[profile.role] ?? profile.role) : ''}
                readOnly
                disabled
                className="text-sm bg-pq-neutral-50 text-pq-neutral-500 cursor-not-allowed opacity-70"
              />
            </div>

            {/* Position — read-only */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                <Briefcase className="w-3.5 h-3.5 text-pq-neutral-400" />
                Position
                <span className="ml-1 text-[10px] font-normal text-pq-neutral-400 normal-case tracking-normal">read-only</span>
              </Label>
              <Input
                value={profile?.position ?? ''}
                readOnly
                disabled
                className="text-sm bg-pq-neutral-50 text-pq-neutral-500 cursor-not-allowed opacity-70"
              />
            </div>

            {/* Department — read-only */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                <Building2 className="w-3.5 h-3.5 text-pq-neutral-400" />
                Department
                <span className="ml-1 text-[10px] font-normal text-pq-neutral-400 normal-case tracking-normal">read-only</span>
              </Label>
              <Input
                value={profile?.department ?? ''}
                readOnly
                disabled
                className="text-sm bg-pq-neutral-50 text-pq-neutral-500 cursor-not-allowed opacity-70"
              />
            </div>

            {nameError && (
              <div className="flex items-start gap-2 text-xs text-pq-danger-600 bg-pq-danger-100 border border-pq-danger-100 rounded px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{nameError}</span>
              </div>
            )}

            {nameSuccess && (
              <div className="flex items-center gap-2 text-xs text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Name updated successfully.</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={!nameChanged || nameSaving || !fullName.trim()}
                size="sm"
                className="text-xs bg-pq-primary-600 hover:bg-pq-neutral-900 w-full sm:w-auto"
              >
                {nameSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>

        {/* Section 2: Change Password */}
        <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50">
            <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Change Password</h2>
          </div>

          <form onSubmit={handleUpdatePassword} className="p-6 space-y-5">

            {/* Current Password */}
            <div className="space-y-1.5">
              <Label htmlFor="current_password" className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                Current Password
              </Label>
              <div className="relative">
                <Input
                  id="current_password"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={pwSaving}
                  className="text-sm pr-10"
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pq-neutral-400 hover:text-pq-neutral-500 transition"
                  tabIndex={-1}
                  aria-label={showCurrent ? 'Hide password' : 'Show password'}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="new_password" className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={pwSaving}
                  className="text-sm pr-10"
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pq-neutral-400 hover:text-pq-neutral-500 transition"
                  tabIndex={-1}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 8 && (
                <p className="text-xs text-pq-danger-600">Must be at least 8 characters.</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm_password" className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={pwSaving}
                  className="text-sm pr-10"
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pq-neutral-400 hover:text-pq-neutral-500 transition"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="text-xs text-pq-danger-600">Passwords do not match.</p>
              )}
            </div>

            {pwError && (
              <div className="flex items-start gap-2 text-xs text-pq-danger-600 bg-pq-danger-100 border border-pq-danger-100 rounded px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div className="flex items-center gap-2 text-xs text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Password updated successfully.</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={!pwValid || pwSaving}
                size="sm"
                className="text-xs bg-pq-primary-600 hover:bg-pq-neutral-900 w-full sm:w-auto"
              >
                {pwSaving ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </div>

      </div>
    </AppShell>
  );
}
