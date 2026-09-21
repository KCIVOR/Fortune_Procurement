'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, Loader2, Pencil, Plus, Search, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useAuth } from '@/context/AuthContext';
import {
  adminUpdateWishlistItem,
  createWishlistItem,
  deleteWishlistItem,
  listAllWishlistItems,
  listMyWishlistItems,
  updateWishlistItem,
} from '@/lib/wishlist';
import type { WishlistItem, WishlistStatus } from '@/types/wishlist';
import type { AppRole } from '@/types/auth';

const STATUS_LABELS: Record<WishlistStatus, string> = {
  open: 'Open',
  planned: 'Planned',
  in_progress: 'In progress',
  completed: 'Completed',
  declined: 'Declined',
};
const STATUS_STYLES: Record<WishlistStatus, string> = {
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  planned: 'bg-violet-50 text-violet-700 border-violet-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined: 'bg-pq-neutral-100 text-pq-neutral-600 border-pq-neutral-200',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function StatusChip({ status }: { status: WishlistStatus }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export default function WishlistPage() {
  const { profile } = useAuth();
  return <AppShell title="Wishlist">{profile?.role === 'admin' ? <AdminWishlistView profile={profile} /> : <UserWishlistView userId={profile?.id} />}</AppShell>;
}

function UserWishlistView({ userId }: { userId?: string }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: '' });
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '' });

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try { setItems(await listMyWishlistItems(userId)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to load your wishlist.'); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) { toast.error('Title and description are required.'); return; }
    setSaving(true);
    try {
      await createWishlistItem(form, userId);
      setForm({ title: '', description: '', category: '' });
      toast.success('Wishlist idea submitted.');
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to submit your idea.'); }
    finally { setSaving(false); }
  };

  const beginEdit = (item: WishlistItem) => {
    setEditingId(item.id);
    setEditForm({ title: item.title, description: item.description, category: item.category ?? '' });
  };
  const saveEdit = async (event: React.FormEvent, id: string) => {
    event.preventDefault();
    setSaving(true);
    try { await updateWishlistItem(id, editForm, userId); setEditingId(null); toast.success('Wishlist idea updated.'); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to update your idea.'); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm('Delete this wishlist idea?')) return;
    setSaving(true);
    try { await deleteWishlistItem(id, userId); toast.success('Wishlist idea deleted.'); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to delete your idea.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Wishlist" description="Share improvements you would like to see in the procurement system." />
      <section className="rounded-lg border border-pq-neutral-200 bg-white p-5 mb-6">
        <div className="flex items-center gap-2 mb-4"><Plus className="w-4 h-4 text-pq-primary-600" /><h2 className="text-sm font-semibold text-pq-neutral-900">Submit an idea</h2></div>
        <form onSubmit={submit} className="space-y-4">
          <div><label htmlFor="wishlist-title" className="block text-sm font-medium text-pq-neutral-700 mb-1">Title</label><input id="wishlist-title" maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full rounded-md border border-pq-neutral-300 px-3 py-2 text-sm" placeholder="What would you like to improve?" /></div>
          <div><label htmlFor="wishlist-description" className="block text-sm font-medium text-pq-neutral-700 mb-1">Description</label><textarea id="wishlist-description" maxLength={4000} rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full rounded-md border border-pq-neutral-300 px-3 py-2 text-sm" placeholder="Describe the problem or desired improvement." /></div>
          <div><label htmlFor="wishlist-category" className="block text-sm font-medium text-pq-neutral-700 mb-1">Category <span className="font-normal text-pq-neutral-400">(optional)</span></label><input id="wishlist-category" maxLength={80} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-pq-neutral-300 px-3 py-2 text-sm" placeholder="e.g. Reporting, Approvals" /></div>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-pq-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pq-primary-700 disabled:opacity-60"><Heart className="w-4 h-4" />{saving ? 'Submitting…' : 'Submit idea'}</button>
        </form>
      </section>

      <section className="rounded-lg border border-pq-neutral-200 bg-white overflow-hidden">
        <div className="border-b border-pq-neutral-200 px-5 py-4"><h2 className="text-sm font-semibold text-pq-neutral-900">My ideas</h2></div>
        {loading ? <div className="flex justify-center p-10"><Loader2 className="w-5 h-5 animate-spin text-pq-primary-600" /></div> : items.length === 0 ? <EmptyState icon={Heart} title="No wishlist ideas yet" description="Your submitted ideas will appear here." /> : <div className="divide-y divide-pq-neutral-200">{items.map(item => (
          <article key={item.id} className="p-5">
            {editingId === item.id ? <form onSubmit={e => saveEdit(e, item.id)} className="space-y-3"><input aria-label="Edit title" maxLength={160} value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full rounded-md border border-pq-neutral-300 px-3 py-2 text-sm" /><textarea aria-label="Edit description" maxLength={4000} rows={3} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="w-full rounded-md border border-pq-neutral-300 px-3 py-2 text-sm" /><input aria-label="Edit category" maxLength={80} value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} className="w-full rounded-md border border-pq-neutral-300 px-3 py-2 text-sm" /><div className="flex gap-2"><button disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-pq-primary-600 px-3 py-1.5 text-xs font-semibold text-white"><Save className="w-3.5 h-3.5" />Save</button><button type="button" onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 rounded-md border border-pq-neutral-300 px-3 py-1.5 text-xs font-semibold text-pq-neutral-700"><X className="w-3.5 h-3.5" />Cancel</button></div></form> : <><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-pq-neutral-900">{item.title}</h3><StatusChip status={item.status} />{item.category && <span className="text-xs text-pq-neutral-500">{item.category}</span>}</div><p className="mt-1 text-sm text-pq-neutral-600 whitespace-pre-wrap">{item.description}</p><p className="mt-2 text-xs text-pq-neutral-400">Submitted {formatDate(item.created_at)}</p>{item.admin_notes && <p className="mt-3 rounded-md bg-pq-neutral-50 p-3 text-xs text-pq-neutral-600"><strong>Admin note:</strong> {item.admin_notes}</p>}</div>{item.status === 'open' && <div className="flex shrink-0 gap-1"><button aria-label="Edit wishlist idea" onClick={() => beginEdit(item)} className="rounded-md p-2 text-pq-neutral-500 hover:bg-pq-neutral-50 hover:text-pq-primary-600"><Pencil className="w-4 h-4" /></button><button aria-label="Delete wishlist idea" onClick={() => remove(item.id)} className="rounded-md p-2 text-pq-neutral-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></div>}</div>{item.status !== 'open' && <p className="mt-3 text-xs text-pq-neutral-500">Only open ideas can be edited or deleted.</p>}</>}
          </article>
        ))}</div>}
      </section>
    </div>
  );
}

function AdminWishlistView({ profile }: { profile: { id: string; role: AppRole } }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WishlistStatus>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { status: WishlistStatus; admin_notes: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listAllWishlistItems(profile);
      setItems(rows);
      setDrafts(Object.fromEntries(rows.map(item => [item.id, { status: item.status, admin_notes: item.admin_notes ?? '' }])));
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to load the wishlist queue.'); }
    finally { setLoading(false); }
  }, [profile]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(item => (statusFilter === 'all' || item.status === statusFilter) && (!needle || [item.title, item.description, item.category ?? '', item.reporter?.full_name ?? '', item.reporter?.email ?? ''].join(' ').toLowerCase().includes(needle)));
  }, [items, query, statusFilter]);

  const update = async (item: WishlistItem) => {
    const draft = drafts[item.id];
    if (!draft) return;
    setSavingId(item.id);
    try { await adminUpdateWishlistItem(item.id, draft, profile); toast.success('Wishlist idea updated.'); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to update the wishlist idea.'); }
    finally { setSavingId(null); }
  };

  return <div className="mx-auto max-w-6xl"><PageHeader title="Wishlist" description="Review and triage improvement ideas submitted by users." />
    <section className="rounded-lg border border-pq-neutral-200 bg-white overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-pq-neutral-200 p-4 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-pq-neutral-400" /><input aria-label="Search wishes" placeholder="Search wishes" value={query} onChange={e => setQuery(e.target.value)} className="w-full rounded-md border border-pq-neutral-300 py-2 pl-9 pr-3 text-sm" /></div><select aria-label="Filter status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | WishlistStatus)} className="rounded-md border border-pq-neutral-300 px-3 py-2 text-sm"><option value="all">All statuses</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      {loading ? <div className="flex justify-center p-10"><Loader2 className="w-5 h-5 animate-spin text-pq-primary-600" /></div> : filtered.length === 0 ? <EmptyState icon={Heart} title="No matching wishes" description="Submitted ideas will appear here for review." /> : <div className="divide-y divide-pq-neutral-200">{filtered.map(item => { const draft = drafts[item.id] ?? { status: item.status, admin_notes: item.admin_notes ?? '' }; return <article key={item.id} className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-pq-neutral-900">{item.title}</h3><StatusChip status={item.status} />{item.category && <span className="text-xs text-pq-neutral-500">{item.category}</span>}</div><p className="mt-1 text-sm text-pq-neutral-600 whitespace-pre-wrap">{item.description}</p><p className="mt-2 text-xs text-pq-neutral-400">{item.reporter?.full_name || item.reporter?.email || 'Unknown user'} · {formatDate(item.created_at)}</p></div><div className="w-full space-y-2 lg:w-72"><select aria-label={`Status for ${item.title}`} value={draft.status} onChange={e => setDrafts({ ...drafts, [item.id]: { ...draft, status: e.target.value as WishlistStatus } })} className="w-full rounded-md border border-pq-neutral-300 px-3 py-2 text-sm">{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><textarea aria-label={`Admin note for ${item.title}`} value={draft.admin_notes} onChange={e => setDrafts({ ...drafts, [item.id]: { ...draft, admin_notes: e.target.value } })} maxLength={4000} rows={2} placeholder="Admin note (optional)" className="w-full rounded-md border border-pq-neutral-300 px-3 py-2 text-sm" /><button disabled={savingId === item.id} onClick={() => update(item)} className="inline-flex items-center gap-1 rounded-md bg-pq-primary-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"><Save className="w-3.5 h-3.5" />{savingId === item.id ? 'Saving…' : 'Save changes'}</button></div></div></article>; })}</div>}
    </section>
  </div>;
}
