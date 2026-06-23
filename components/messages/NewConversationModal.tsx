'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import FilterBar from '@/components/shared/FilterBar';
import PaginationControls from '@/components/shared/PaginationControls';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import { Users, Loader2, MessageSquarePlus } from 'lucide-react';
import {
  createOrGetConversation,
  fetchConversationById,
  fetchDirectoryUsers,
  fetchDirectoryFilterOptions,
  type ConversationWithProfiles,
  type DirectoryUser,
} from '@/lib/messages';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onConversationReady: (conversation: ConversationWithProfiles) => void;
}

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  procurement: 'Procurement',
  approver:    'Approver',
  warehouse:   'Warehouse',
  employee:    'Employee',
  admin:       'Admin',
  tsqa:        'TSQA',
  supplier:    'Supplier',
};

const ROLE_BADGE: Record<string, string> = {
  procurement: 'bg-pq-primary-100 text-pq-primary-700',
  approver:    'bg-pq-success-100 text-pq-success-700',
  warehouse:   'bg-pq-warning-100 text-pq-warning-700',
  employee:    'bg-pq-neutral-100 text-pq-neutral-600',
  admin:       'bg-pq-danger-100 text-pq-danger-700',
  tsqa:        'bg-teal-100 text-teal-700',
  supplier:    'bg-purple-100 text-purple-700',
};

const ROLE_AVATAR: Record<string, string> = {
  procurement: 'bg-pq-primary-100 text-pq-primary-700',
  approver:    'bg-pq-success-100 text-pq-success-700',
  warehouse:   'bg-pq-warning-100 text-pq-warning-700',
  employee:    'bg-pq-neutral-100 text-pq-neutral-600',
  admin:       'bg-pq-danger-100 text-pq-danger-700',
  tsqa:        'bg-teal-100 text-teal-700',
  supplier:    'bg-purple-100 text-purple-700',
};

function roleBadgeClass(name: string | undefined) {
  return ROLE_BADGE[name ?? ''] ?? 'bg-pq-neutral-100 text-pq-neutral-500';
}
function roleAvatarClass(name: string | undefined) {
  return ROLE_AVATAR[name ?? ''] ?? 'bg-pq-neutral-100 text-pq-neutral-500';
}
function roleLabel(name: string | undefined) {
  return ROLE_LABELS[name ?? ''] ?? (name ?? 'Unknown');
}
function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
}

const PAGE_SIZE = 10;

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function NewConversationModal({
  isOpen,
  onClose,
  currentUserId,
  onConversationReady,
}: NewConversationModalProps) {
  const [users,         setUsers]         = useState<DirectoryUser[]>([]);
  const [total,         setTotal]         = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  // Filter inputs. `search` is the live input; `appliedSearch` is the debounced
  // value that actually drives the query (avoids one request per keystroke).
  const [search,          setSearch]          = useState('');
  const [appliedSearch,   setAppliedSearch]   = useState('');
  const [positionFilter,  setPositionFilter]  = useState('');
  const [deptFilter,      setDeptFilter]      = useState('');
  const [page,            setPage]            = useState(1);

  // Filter dropdown options (fetched from source tables, not the user list)
  const [positionOptions, setPositionOptions] = useState<{ value: string; label: string }[]>([]);
  const [deptOptions,     setDeptOptions]     = useState<{ value: string; label: string }[]>([]);

  // Debounce the search box → appliedSearch
  useEffect(() => {
    const t = setTimeout(() => setAppliedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter change resets to the first page
  useEffect(() => { setPage(1); }, [appliedSearch, positionFilter, deptFilter]);

  // Load filter dropdown options once when the modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      try {
        const { positions, departments } = await fetchDirectoryFilterOptions();
        if (cancelled) return;
        setPositionOptions(positions.map((p: string) => ({ value: p, label: p })));
        setDeptOptions(departments.map((d: string) => ({ value: d, label: d })));
      } catch (err) {
        if (!cancelled) console.error('Failed to load filter options:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen]);

  // Fetch the current page whenever the query (filters/page) changes
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { users, total } = await fetchDirectoryUsers(currentUserId, {
          search: appliedSearch,
          position: positionFilter,
          department: deptFilter,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        });
        if (!cancelled) {
          setUsers(users);
          setTotal(total);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load directory page:', err);
          setUsers([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, currentUserId, appliedSearch, positionFilter, deptFilter, page]);

  // Reset everything on close
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setAppliedSearch('');
      setPositionFilter('');
      setDeptFilter('');
      setPage(1);
      setUsers([]);
      setTotal(0);
    }
  }, [isOpen]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleClearFilters() {
    setSearch('');
    setPositionFilter('');
    setDeptFilter('');
  }

  async function handleSelectUser(user: DirectoryUser) {
    if (loadingUserId) return;
    setLoadingUserId(user.id);
    try {
      const conversationId = await createOrGetConversation(user.id);
      const conversation   = await fetchConversationById(conversationId);
      if (conversation) onConversationReady(conversation);
      onClose();
    } catch (err: any) {
      console.error('Failed to start conversation:', err);
      toast.error(err?.message ?? 'Failed to start conversation.');
    } finally {
      setLoadingUserId(null);
    }
  }

  const filterConfigs: FilterConfig[] = [
    {
      type: 'search',
      id: 'dir-search',
      label: 'Search',
      placeholder: 'Search by name or email…',
      value: search,
      onChange: v => setSearch(v as string),
    },
    {
      type: 'select',
      id: 'dir-position',
      label: 'Position',
      placeholder: 'All positions',
      value: positionFilter || '__all__',
      onChange: v => setPositionFilter(v === '__all__' ? '' : v as string),
      options: [{ value: '__all__', label: 'All positions' }, ...positionOptions],
    },
    {
      type: 'select',
      id: 'dir-dept',
      label: 'Department',
      placeholder: 'All departments',
      value: deptFilter || '__all__',
      onChange: v => setDeptFilter(v === '__all__' ? '' : v as string),
      options: [{ value: '__all__', label: 'All departments' }, ...deptOptions],
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="flex flex-col gap-0 p-0 overflow-hidden w-[calc(100%-1rem)] max-w-3xl max-h-[min(92dvh,760px)] sm:rounded-lg">

        {/* ── Header (never scrolls) ───────────────────────────────────── */}
        <DialogHeader className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-pq-neutral-100 text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-pq-primary-50 border border-pq-primary-100 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-pq-primary-600" />
            </div>
            <div>
              <DialogTitle className="text-sm sm:text-base font-semibold text-pq-neutral-900">
                People Directory
              </DialogTitle>
              <p className="text-[11px] sm:text-xs text-pq-neutral-500 mt-0.5">
                Tap <strong>Message</strong> on any person to start a conversation.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Filters (pinned — never scroll) ──────────────────────────── */}
        <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-pq-neutral-100 bg-pq-neutral-50">
          <FilterBar
            filters={filterConfigs}
            onClear={handleClearFilters}
            loading={loading}
            resultCount={loading ? undefined : total}
            resultLabel="person"
            compact
            className="!border-0 !shadow-none !rounded-none !bg-transparent !overflow-visible"
          />
        </div>

        {/* ── List (the ONLY scrolling region) ─────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">

          {loading ? (
            <div className="p-4 sm:p-6">
              <TableSkeleton rows={6} cols={3} />
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No people found"
              description="Try adjusting your search or filters."
              className="py-16"
            />
          ) : (
            <Table>
              {/* Sticky header so column labels stay while rows scroll */}
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="border-b border-pq-neutral-200 bg-pq-neutral-50 hover:bg-pq-neutral-50">
                  <TableHead className="text-xs font-semibold text-pq-neutral-500 min-w-[160px] pl-4 sm:pl-6 bg-pq-neutral-50">
                    Name
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-pq-neutral-500 hidden sm:table-cell bg-pq-neutral-50">
                    Role
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-pq-neutral-500 hidden md:table-cell bg-pq-neutral-50">
                    Position
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-pq-neutral-500 hidden lg:table-cell bg-pq-neutral-50">
                    Department
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-pq-neutral-500 text-right w-16 pr-4 sm:pr-6 bg-pq-neutral-50">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                    {users.map((user: DirectoryUser) => {
                      const isRowLoading  = loadingUserId === user.id;
                      const isRowDisabled = loadingUserId !== null && !isRowLoading;

                      return (
                        <TableRow
                          key={user.id}
                          className={cn(
                            'border-b border-pq-neutral-100 transition-colors',
                            isRowLoading  ? 'bg-pq-primary-50' :
                            isRowDisabled ? 'opacity-50'       :
                            'hover:bg-pq-neutral-50',
                          )}
                        >
                          {/* Name + email — always visible. On mobile also shows role badge. */}
                          <TableCell className="py-2.5 sm:py-3 pl-4 sm:pl-6">
                            <div className="flex items-center gap-2.5 sm:gap-3">
                              <div className={cn(
                                'w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-xs font-bold',
                                isRowLoading ? 'bg-pq-primary-600 text-white' : roleAvatarClass(user.role?.name),
                              )}>
                                {isRowLoading
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : getInitials(user.full_name)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-pq-neutral-900 truncate leading-tight">
                                  {user.full_name}
                                </p>
                                <p className="text-[11px] text-pq-neutral-400 truncate mt-0.5">
                                  {user.email}
                                </p>
                                {/* Role badge — only on mobile (hidden sm+) */}
                                <span className={cn(
                                  'sm:hidden inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize',
                                  roleBadgeClass(user.role?.name),
                                )}>
                                  {roleLabel(user.role?.name)}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Role — sm+ only */}
                          <TableCell className="py-2.5 sm:py-3 hidden sm:table-cell">
                            <span className={cn(
                              'px-2 py-1 rounded text-xs font-medium capitalize',
                              roleBadgeClass(user.role?.name),
                            )}>
                              {roleLabel(user.role?.name)}
                            </span>
                          </TableCell>

                          {/* Position — md+ only */}
                          <TableCell className="py-2.5 sm:py-3 hidden md:table-cell text-xs text-pq-neutral-600 max-w-[160px] truncate">
                            {user.position?.title ?? '—'}
                          </TableCell>

                          {/* Department — lg+ only */}
                          <TableCell className="py-2.5 sm:py-3 hidden lg:table-cell text-xs text-pq-neutral-600">
                            {user.department?.name ?? '—'}
                          </TableCell>

                          {/* Action — always visible */}
                          <TableCell className="py-2.5 sm:py-3 text-right pr-4 sm:pr-6">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectUser(user)}
                              disabled={isRowDisabled || isRowLoading}
                              className={cn(
                                'text-pq-primary-600 hover:text-pq-neutral-900 hover:bg-pq-primary-50',
                                isRowLoading && 'cursor-wait opacity-80',
                              )}
                              title={`Message ${user.full_name}`}
                            >
                              {isRowLoading
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <MessageSquarePlus className="w-4 h-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
          )}

        </div>

        {/* ── Pagination (pinned footer — never scrolls) ───────────────── */}
        {total > PAGE_SIZE && (
          <div className="shrink-0 border-t border-pq-neutral-100">
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              pageSize={PAGE_SIZE}
              totalCount={total}
              entityLabel="person"
              loading={loading}
              onPageChange={setPage}
              className="!border-0 !rounded-none"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
