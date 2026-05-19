'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, Eye, EyeOff, RefreshCw, CircleAlert as AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  onSuccess?: () => void;
}

interface PasswordDisplayState {
  show: boolean;
  copied: boolean;
}

export default function ResetPasswordModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  onSuccess,
}: ResetPasswordModalProps) {
  const { session } = useAuth();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordDisplay, setPasswordDisplay] = useState<PasswordDisplayState>({ show: false, copied: false });
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordDisplay, setNewPasswordDisplay] = useState<PasswordDisplayState>({ show: false, copied: false });

  function generateRandomPassword(): string {
    const length = 16;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < length; i++) {
      pwd += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return pwd;
  }

  function handleGeneratePassword() {
    const generated = generateRandomPassword();
    setPassword(generated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ new_password: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        setLoading(false);
        return;
      }

      setNewPassword(password);
      setStep('success');
      setNewPasswordDisplay({ show: true, copied: false });

      const timeout = setTimeout(() => {
        handleClose();
      }, 90000);

      return () => clearTimeout(timeout);
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  function handleCopyPassword() {
    navigator.clipboard.writeText(newPassword);
    setNewPasswordDisplay({ ...newPasswordDisplay, copied: true });
    setTimeout(() => {
      setNewPasswordDisplay({ ...newPasswordDisplay, copied: false });
    }, 2000);
  }

  function handleClose() {
    setStep('form');
    setPassword('');
    setNewPassword('');
    setError('');
    setPasswordDisplay({ show: false, copied: false });
    setNewPasswordDisplay({ show: false, copied: false });
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'form' ? 'Reset User Password' : 'Password Reset Successfully'}
          </DialogTitle>
          <DialogClose />
        </DialogHeader>

        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-4 h-4 text-pq-danger-600 shrink-0 mt-0.5" />
                <p className="text-xs text-pq-danger-600">{error}</p>
              </div>
            )}

            <div className="bg-pq-primary-50 border border-pq-primary-200 rounded-lg p-3">
              <p className="text-xs text-pq-primary-600">
                <strong>Resetting password for:</strong> {userEmail}
              </p>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-pq-neutral-500">
                New Temporary Password
              </Label>
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <Input
                    id="password"
                    type={passwordDisplay.show ? 'text' : 'password'}
                    placeholder="Leave empty to auto-generate"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordDisplay({ ...passwordDisplay, show: !passwordDisplay.show })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-pq-neutral-500 hover:text-pq-neutral-900 transition"
                    title={passwordDisplay.show ? 'Hide' : 'Show'}
                  >
                    {passwordDisplay.show ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeneratePassword}
                  disabled={loading}
                  className="px-3 py-2"
                  title="Generate random password"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-pq-neutral-500">
                {password ? `${password.length} characters` : 'Will be auto-generated if left empty'}
              </p>
            </div>

            <div className="bg-pq-warning-100 border border-pq-warning-100 rounded-lg p-3">
              <p className="text-xs text-pq-warning-600">
                <strong>Warning:</strong> User will need to change this temporary password on first login for security.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !password || password.length < 8}
                className="flex-1 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-pq-success-100 border border-pq-success-100 rounded-lg p-4">
              <p className="text-sm text-pq-success-600 font-medium">Password reset successfully!</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-pq-neutral-500">New Temporary Password</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-pq-neutral-50 border border-pq-neutral-200 rounded-lg">
                  <p className="text-sm font-mono text-pq-neutral-900 break-all">
                    {newPasswordDisplay.show ? newPassword : '•'.repeat(newPassword.length)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewPasswordDisplay({ ...newPasswordDisplay, show: !newPasswordDisplay.show })}
                  className="p-2 text-pq-neutral-500 hover:bg-pq-neutral-50 rounded transition"
                  title={newPasswordDisplay.show ? 'Hide' : 'Show'}
                >
                  {newPasswordDisplay.show ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-pq-primary-50 border border-pq-primary-200 rounded-lg p-3">
              <p className="text-xs text-pq-primary-600">
                <strong>Share this password with the user.</strong> It will be hidden after you close this modal and cannot be recovered. The user must change their password on first login.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={handleCopyPassword}
                className="flex-1 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white flex items-center gap-2 justify-center"
              >
                {newPasswordDisplay.copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Password
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
