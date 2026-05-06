'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Check, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string; role_id: string | null }>;
  onUserCreated?: () => void;
}

interface PasswordDisplayState {
  show: boolean;
  copied: boolean;
}

function readCreateUserApiError(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Failed to create user';
  const o = data as Record<string, unknown>;
  for (const key of ['error', 'message', 'msg'] as const) {
    const v = o[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return 'Failed to create user';
}

export default function CreateUserModal({
  isOpen,
  onClose,
  roles,
  departments,
  positions,
  onUserCreated,
}: CreateUserModalProps) {
  const { session } = useAuth();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [passwordDisplay, setPasswordDisplay] = useState<PasswordDisplayState>({ show: false, copied: false });
  const [passwordFieldDisplay, setPasswordFieldDisplay] = useState<PasswordDisplayState>({ show: false, copied: false });

  // Form fields
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role_id: '',
    department_id: '',
    position_id: '',
  });

  function generateRandomPassword(): string {
    const length = 16;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  function handleGeneratePassword() {
    const newPassword = generateRandomPassword();
    setFormData({ ...formData, password: newPassword });
  }

  const handleRoleChange = (roleId: string) => {
    setFormData({ ...formData, role_id: roleId, position_id: '' });
  };

  const filteredPositions = formData.role_id
    ? positions.filter((p) => p.role_id === formData.role_id)
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify(formData),
      });

      let data: Record<string, unknown> = {};
      try {
        const text = await response.text();
        if (text) data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        setError(`Invalid response from server (HTTP ${response.status}).`);
        return;
      }

      const failed =
        !response.ok || data.success === false;

      if (failed) {
        setError(readCreateUserApiError(data));
        return;
      }

      setTempPassword(typeof data.temp_password === 'string' ? data.temp_password : '');
      setUserEmail(
        typeof data.user_email === 'string' ? data.user_email :
        typeof data.email === 'string' ? data.email :
        formData.email
      );
      setStep('success');
      setPasswordDisplay({ show: true, copied: false });

      setTimeout(() => {
        handleClose();
      }, 90000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Network error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  function handleCopyPassword() {
    navigator.clipboard.writeText(tempPassword);
    setPasswordDisplay({ ...passwordDisplay, copied: true });
    setTimeout(() => {
      setPasswordDisplay({ ...passwordDisplay, copied: false });
    }, 2000);
  }

  function handleClose() {
    setStep('form');
    setFormData({ full_name: '', email: '', password: '', role_id: '', department_id: '', position_id: '' });
    setTempPassword('');
    setUserEmail('');
    setError('');
    setPasswordDisplay({ show: false, copied: false });
    setPasswordFieldDisplay({ show: false, copied: false });
    if (onUserCreated) {
      onUserCreated();
    }
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'success'
              ? 'User Created Successfully'
              : error
              ? 'Failed to Create User'
              : 'Create New User'}
          </DialogTitle>
          <DialogClose />
        </DialogHeader>

        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-red-800">{error}</p>
              </div>
            )}

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full-name" className="text-xs font-medium text-[#40527A]">
                Full Name
              </Label>
              <Input
                id="full-name"
                type="text"
                placeholder="e.g., John Doe"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                disabled={loading}
                className="text-sm"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-[#40527A]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="e.g., john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={loading}
                className="text-sm"
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role" className="text-xs font-medium text-[#40527A]">
                Role
              </Label>
              <Select
                value={formData.role_id}
                onValueChange={handleRoleChange}
                disabled={loading}
              >
                <SelectTrigger id="role" className="text-sm">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Position */}
            <div className="space-y-2">
              <Label htmlFor="position" className="text-xs font-medium text-[#40527A]">
                Position
              </Label>
              <Select
                value={formData.position_id}
                onValueChange={(value) => setFormData({ ...formData, position_id: value })}
                disabled={loading || !formData.role_id}
              >
                <SelectTrigger id="position" className="text-sm">
                  <SelectValue placeholder={formData.role_id ? 'Select a position' : 'Choose role first'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredPositions.map((pos) => (
                    <SelectItem key={pos.id} value={pos.id}>
                      {pos.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department" className="text-xs font-medium text-[#40527A]">
                Department
              </Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                disabled={loading}
              >
                <SelectTrigger id="department" className="text-sm">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-[#40527A]">
                Temporary Password
              </Label>
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <Input
                    id="password"
                    type={passwordFieldDisplay.show ? 'text' : 'password'}
                    placeholder="Leave empty to auto-generate"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    disabled={loading}
                    className="text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordFieldDisplay({ ...passwordFieldDisplay, show: !passwordFieldDisplay.show })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#40527A] hover:text-[#0F1F3A] transition"
                    title={passwordFieldDisplay.show ? 'Hide' : 'Show'}
                  >
                    {passwordFieldDisplay.show ? (
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
              <p className="text-xs text-[#7A8BA8]">
                {formData.password ? `${formData.password.length} characters` : 'Will be auto-generated if left empty'}
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
                disabled={loading || !formData.full_name || !formData.email || !formData.role_id || !formData.position_id || !formData.department_id || Boolean(formData.password && formData.password.length < 8)}
                className="flex-1 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white"
              >
                {loading ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 font-medium">User created successfully!</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-[#40527A]">Email</Label>
              <div className="p-3 bg-[#F7F9FC] border border-[#D8E2FF] rounded-lg">
                <p className="text-sm font-mono text-[#0F1F3A]">{userEmail}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-[#40527A]">Temporary Password</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-[#F7F9FC] border border-[#D8E2FF] rounded-lg">
                  <p className="text-sm font-mono text-[#0F1F3A] break-all">
                    {passwordDisplay.show ? tempPassword : '•'.repeat(tempPassword.length)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordDisplay({ ...passwordDisplay, show: !passwordDisplay.show })}
                  className="p-2 text-[#40527A] hover:bg-[#F7F9FC] rounded transition"
                  title={passwordDisplay.show ? 'Hide' : 'Show'}
                >
                  {passwordDisplay.show ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
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
                className="flex-1 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white flex items-center gap-2 justify-center"
              >
                {passwordDisplay.copied ? (
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
