'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, MessageSquarePlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import { cn } from '@/lib/utils';

interface UserSearchProps {
  currentUserId: string;
  onSelectUser: (user: Pick<Profile, 'id' | 'full_name' | 'email'>) => void;
  className?: string;
}

export default function UserSearch({
  currentUserId,
  onSelectUser,
  className,
}: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Pick<Profile, 'id' | 'full_name' | 'email'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const db = supabase as any;
        const { data, error } = await db
          .from('profiles')
          .select('id, full_name, email')
          .neq('id', currentUserId)
          .ilike('full_name', `%${query.trim()}%`)
          .limit(8);

        if (error) throw error;
        setResults((data ?? []) as Pick<Profile, 'id' | 'full_name' | 'email'>[]);
        setIsOpen(true);
      } catch (err) {
        console.error('User search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, currentUserId]);

  function handleSelect(user: Pick<Profile, 'id' | 'full_name' | 'email'>) {
    onSelectUser(user);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  }

  function handleClear() {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pq-neutral-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users to message..."
          className="w-full h-10 pl-9 pr-9 rounded-md border border-pq-neutral-300 bg-pq-white text-sm text-pq-neutral-900 placeholder:text-pq-neutral-400 focus-visible:outline-none focus-visible:border-pq-primary-500 focus-visible:ring-2 focus-visible:ring-pq-primary-500/25 transition"
          aria-label="Search users"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-pq-neutral-400 hover:text-pq-neutral-600 transition"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-pq-neutral-200 rounded-md shadow-lg z-50 overflow-hidden max-h-[280px] overflow-y-auto">
          {loading ? (
            <div className="px-4 py-6 text-center text-xs text-pq-neutral-400">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-pq-neutral-400">
              No users found
            </div>
          ) : (
            results.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelect(user)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-pq-neutral-50 transition group"
              >
                <div className="w-8 h-8 rounded-md bg-pq-neutral-100 flex items-center justify-center shrink-0 group-hover:bg-pq-primary-100 transition">
                  <span className="text-xs font-semibold text-pq-neutral-500 group-hover:text-pq-primary-700">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-pq-neutral-900 truncate">
                    {user.full_name}
                  </p>
                  <p className="text-xs text-pq-neutral-400 truncate">{user.email}</p>
                </div>
                <MessageSquarePlus className="w-4 h-4 text-pq-neutral-300 group-hover:text-pq-primary-600 transition shrink-0" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
