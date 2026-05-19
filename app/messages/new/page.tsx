'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import { UserSearch } from '@/components/messages';
import { useAuth } from '@/context/AuthContext';
import LoadingState from '@/components/shared/LoadingState';
import { createOrGetConversation } from '@/lib/messages';
import type { Profile } from '@/types/database';
import { ArrowLeft, MessageSquarePlus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NewMessagePage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleSelectUser(user: Pick<Profile, 'id' | 'full_name' | 'email'>) {
    if (!profile) return;

    // Prevent self-messaging (extra client-side guard; RPC also enforces this)
    if (user.id === profile.id) {
      toast.error('You cannot message yourself.');
      return;
    }

    setCreating(true);
    try {
      await createOrGetConversation(user.id);
      // Navigate back to messages — the conversation will appear in the list
      router.push('/messages');
      toast.success(`Conversation with ${user.full_name} ready.`);
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
      const message = err?.message || 'Failed to start conversation.';
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  if (loading || !profile) {
    return (
      <AppShell title="New Message">
        <div className="flex items-center justify-center h-64">
          <LoadingState message="Loading..." />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="New Message">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/messages"
          className="flex items-center gap-2 text-xs font-bold text-pq-neutral-500 hover:text-pq-primary-600 transition uppercase tracking-wider group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Messages
        </Link>
      </div>

      <PageHeader
        title="New Message"
        description="Search for a user to start a conversation."
      />

      <div className="bg-white rounded-lg border border-pq-neutral-200 shadow-sm p-6 max-w-lg">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquarePlus className="w-5 h-5 text-pq-primary-600" />
          <h2 className="text-sm font-semibold text-pq-neutral-900">Find a user</h2>
        </div>

        <UserSearch
          currentUserId={profile.id}
          onSelectUser={handleSelectUser}
        />

        {creating && (
          <div className="mt-6 flex items-center justify-center">
            <LoadingState message="Starting conversation..." size="sm" />
          </div>
        )}

        <p className="mt-4 text-xs text-pq-neutral-400">
          Search by name. If a conversation already exists, it will be reused.
        </p>
      </div>
    </AppShell>
  );
}
