'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PaymentTermsSelect from '@/components/shared/PaymentTermsSelect';
import { Copy, Check, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface CreateSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSupplierCreated?: () => void;
}

interface PasswordDisplayState {
  show: boolean;
  copied: boolean;
}

interface SupplierFormState {
  full_name: string;
  email: string;
  payment_terms: string;
  password: string;
}

const MODAL_SHELL =
  'flex flex-col gap-0 p-0 overflow-hidden w-[calc(100%-1rem)] max-w-md max-h-[min(92dvh,840px)] sm:rounded-lg';

const SCROLL_BODY = 'flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4';

const FOOTER =
  'shrink-0 border-t border-pq-neutral-100 bg-pq-white px-4 sm:px-6 py-3 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]';

const EMPTY_FORM: SupplierFormState = {
  full_name: '',
  email: '',
  payment_terms: '',
  password: '',
};

function readApiError(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Request failed';
  const o = data as Record<string, unknown>;
  for (const key of ['error', 'message', 'msg'] as const) {
    const v = o[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return 'Request failed';
}

function ModalActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col-reverse sm:flex-row gap-2', className)}>
      {children}
    </div>
  );
}

function generateRandomPassword(): string {
  const length = 16;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

function buildPayload(form: SupplierFormState, includePassword: boolean) {
  const payload: Record<string, string | null> = {
    full_name: form.full_name.trim(),
    email: form.email.trim(),
  };
  const terms = form.payment_terms.trim();
  if (terms) payload.payment_terms = terms;
  if (includePassword && form.password) payload.password = form.password;
  return payload;
}

export default function CreateSupplierModal({
  isOpen,
  onClose,
  onSupplierCreated,
}: CreateSupplierModalProps) {
  const { session } = useAuth();
  const [mainTab, setMainTab] = useState<'invite' | 'create'>('invite');
  const [inviteStep, setInviteStep] = useState<'form' | 'success'>('form');
  const [createStep, setCreateStep] = useState<'form' | 'success'>('form');
  const [inviteSentToEmail, setInviteSentToEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteForm, setInviteForm] = useState<SupplierFormState>(EMPTY_FORM);
  const [createForm, setCreateForm] = useState<SupplierFormState>(EMPTY_FORM);
  const [tempPassword, setTempPassword] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [passwordDisplay, setPasswordDisplay] = useState<PasswordDisplayState>({ show: false, copied: false });
  const [passwordFieldDisplay, setPasswordFieldDisplay] = useState<PasswordDisplayState>({
    show: false,
    copied: false,
  });

  async function postSupplier(path: string, body: Record<string, string | null>) {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(body),
    });

    let data: Record<string, unknown> = {};
    try {
      const text = await response.text();
      if (text) data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Invalid response from server (HTTP ${response.status}).`);
    }

    if (!response.ok || data.success === false) {
      throw new Error(readApiError(data));
    }

    return data;
  }

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await postSupplier(
        '/api/procurement/suppliers/invite',
        buildPayload(inviteForm, false),
      );
      const sent =
        typeof data.user_email === 'string'
          ? data.user_email
          : inviteForm.email.trim().toLowerCase();
      setInviteSentToEmail(sent);
      setInviteStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await postSupplier(
        '/api/procurement/suppliers/create',
        buildPayload(createForm, true),
      );
      setTempPassword(typeof data.temp_password === 'string' ? data.temp_password : '');
      setUserEmail(
        typeof data.user_email === 'string'
          ? data.user_email
          : createForm.email.trim().toLowerCase(),
      );
      setCreateStep('success');
      setPasswordDisplay({ show: true, copied: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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
    setMainTab('invite');
    setInviteStep('form');
    setCreateStep('form');
    setInviteSentToEmail('');
    setInviteForm(EMPTY_FORM);
    setCreateForm(EMPTY_FORM);
    setTempPassword('');
    setUserEmail('');
    setError('');
    setPasswordDisplay({ show: false, copied: false });
    setPasswordFieldDisplay({ show: false, copied: false });
    onSupplierCreated?.();
    onClose();
  }

  const title =
    mainTab === 'invite'
      ? inviteStep === 'success'
        ? 'Invitation Sent'
        : error
          ? 'Invitation Failed'
          : 'Add Supplier Account'
      : createStep === 'success'
        ? 'Supplier Created'
        : error
          ? 'Creation Failed'
          : 'Add Supplier Account';

  function renderSharedFields(
    form: SupplierFormState,
    setForm: React.Dispatch<React.SetStateAction<SupplierFormState>>,
    idPrefix: string,
  ) {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-full-name`} className="text-xs font-medium text-pq-neutral-500">
            Company / Supplier Name
          </Label>
          <Input
            id={`${idPrefix}-full-name`}
            type="text"
            placeholder="e.g., Ace Supply Corp"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
            disabled={loading}
            className="text-sm w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-email`} className="text-xs font-medium text-pq-neutral-500">
            Email
          </Label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            placeholder="e.g., vendor@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            disabled={loading}
            className="text-sm w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-payment-terms`} className="text-xs font-medium text-pq-neutral-500">
            Payment Terms (optional)
          </Label>
          <PaymentTermsSelect
            id={`${idPrefix}-payment-terms`}
            value={form.payment_terms}
            onChange={(value) => setForm({ ...form, payment_terms: value })}
            disabled={loading}
            placeholder="No default set..."
          />
        </div>
      </>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className={MODAL_SHELL}>
        <DialogHeader className="shrink-0 px-4 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-pq-neutral-100 text-left">
          <DialogTitle className="pr-8 text-base sm:text-lg leading-snug">{title}</DialogTitle>
        </DialogHeader>

        <Tabs
          value={mainTab}
          onValueChange={(v) => {
            setMainTab(v as 'invite' | 'create');
            setError('');
            setInviteStep('form');
            setCreateStep('form');
          }}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div className="shrink-0 px-4 sm:px-6 pt-3">
            <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-pq-neutral-50">
              <TabsTrigger value="invite" className="text-xs sm:text-sm px-2 py-2">
                Invite by email
              </TabsTrigger>
              <TabsTrigger value="create" className="text-xs sm:text-sm px-2 py-2">
                Create with password
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="invite"
            className="mt-0 flex flex-col flex-1 min-h-0 overflow-hidden focus-visible:outline-none data-[state=inactive]:hidden"
          >
            {inviteStep === 'form' ? (
              <form onSubmit={handleInviteSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className={SCROLL_BODY}>
                  <div className="space-y-4">
                    {error && (
                      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-3">
                        <p className="text-xs text-pq-danger-600 break-words">{error}</p>
                      </div>
                    )}
                    {renderSharedFields(inviteForm, setInviteForm, 'invite')}
                    <p className="text-xs text-pq-neutral-500">
                      The supplier will receive an email to set their password. They can submit accreditation after
                      logging in.
                    </p>
                  </div>
                </div>
                <div className={FOOTER}>
                  <ModalActions>
                    <Button type="button" variant="outline" onClick={handleClose} disabled={loading} className="flex-1 w-full">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading || !inviteForm.full_name || !inviteForm.email}
                      className="flex-1 w-full bg-pq-primary-600 hover:bg-pq-neutral-900 text-white"
                    >
                      {loading ? 'Sending…' : 'Send invitation'}
                    </Button>
                  </ModalActions>
                </div>
              </form>
            ) : (
              <>
                <div className={SCROLL_BODY}>
                  <div className="bg-pq-success-100 border border-pq-success-100 rounded-lg p-4">
                    <p className="text-sm text-pq-success-600 font-medium break-words">
                      Invitation sent to <span className="font-mono">{inviteSentToEmail}</span>. The supplier will set
                      their password from the email link.
                    </p>
                  </div>
                </div>
                <div className={FOOTER}>
                  <Button type="button" onClick={handleClose} className="w-full bg-pq-primary-600 hover:bg-pq-neutral-900 text-white">
                    Close
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent
            value="create"
            className="mt-0 flex flex-col flex-1 min-h-0 overflow-hidden focus-visible:outline-none data-[state=inactive]:hidden"
          >
            {createStep === 'form' ? (
              <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className={SCROLL_BODY}>
                  <div className="space-y-4">
                    {error && (
                      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-3">
                        <p className="text-xs text-pq-danger-600 break-words">{error}</p>
                      </div>
                    )}
                    {renderSharedFields(createForm, setCreateForm, 'create')}
                    <div className="space-y-2">
                      <Label htmlFor="create-password" className="text-xs font-medium text-pq-neutral-500">
                        Temporary Password
                      </Label>
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                        <div className="flex-1 relative min-w-0">
                          <Input
                            id="create-password"
                            type={passwordFieldDisplay.show ? 'text' : 'password'}
                            placeholder="Leave empty to auto-generate"
                            value={createForm.password}
                            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                            disabled={loading}
                            className="text-sm pr-10 w-full"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPasswordFieldDisplay({
                                ...passwordFieldDisplay,
                                show: !passwordFieldDisplay.show,
                              })
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-pq-neutral-500 hover:text-pq-neutral-900 transition"
                            aria-label={passwordFieldDisplay.show ? 'Hide password' : 'Show password'}
                          >
                            {passwordFieldDisplay.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateForm({ ...createForm, password: generateRandomPassword() })}
                          disabled={loading}
                          className="shrink-0 w-full sm:w-auto"
                          aria-label="Generate random password"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-pq-neutral-500">
                        {createForm.password
                          ? `${createForm.password.length} characters`
                          : 'Will be auto-generated if left empty'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className={FOOTER}>
                  <ModalActions>
                    <Button type="button" variant="outline" onClick={handleClose} disabled={loading} className="flex-1 w-full">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        loading ||
                        !createForm.full_name ||
                        !createForm.email ||
                        Boolean(createForm.password && createForm.password.length < 8)
                      }
                      className="flex-1 w-full bg-pq-primary-600 hover:bg-pq-neutral-900 text-white"
                    >
                      {loading ? 'Creating…' : 'Create supplier'}
                    </Button>
                  </ModalActions>
                </div>
              </form>
            ) : (
              <>
                <div className={SCROLL_BODY}>
                  <div className="space-y-4">
                    <div className="bg-pq-success-100 border border-pq-success-100 rounded-lg p-4">
                      <p className="text-sm text-pq-success-600 font-medium">Supplier account created.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-pq-neutral-500">Email</Label>
                      <div className="p-3 bg-pq-neutral-50 border border-pq-neutral-200 rounded-lg">
                        <p className="text-sm font-mono text-pq-neutral-900 break-all">{userEmail}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-pq-neutral-500">Temporary Password</Label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex-1 min-w-0 p-3 bg-pq-neutral-50 border border-pq-neutral-200 rounded-lg">
                          <p className="text-sm font-mono text-pq-neutral-900 break-all">
                            {passwordDisplay.show ? tempPassword : '•'.repeat(tempPassword.length)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPasswordDisplay({ ...passwordDisplay, show: !passwordDisplay.show })
                          }
                          className="p-2 text-pq-neutral-500 hover:bg-pq-neutral-50 rounded transition shrink-0 border border-pq-neutral-200"
                        >
                          {passwordDisplay.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="bg-pq-primary-50 border border-pq-primary-200 rounded-lg p-3">
                      <p className="text-xs text-pq-primary-600 break-words">
                        Share this password with the supplier. It cannot be recovered after you close this modal.
                      </p>
                    </div>
                  </div>
                </div>
                <div className={FOOTER}>
                  <ModalActions>
                    <Button type="button" variant="outline" onClick={handleClose} className="flex-1 w-full">
                      Close
                    </Button>
                    <Button
                      type="button"
                      onClick={handleCopyPassword}
                      className="flex-1 w-full bg-pq-primary-600 hover:bg-pq-neutral-900 text-white flex items-center gap-2 justify-center"
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
                  </ModalActions>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
