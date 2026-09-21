import { db } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type {
  WishlistAdminUpdateInput,
  WishlistCreateInput,
  WishlistItem,
  WishlistStatus,
  WishlistUserUpdateInput,
} from '@/types/wishlist';

const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_CATEGORY_LENGTH = 80;
const MAX_ADMIN_NOTES_LENGTH = 4000;
const STATUSES: WishlistStatus[] = ['open', 'planned', 'in_progress', 'completed', 'declined'];

function cleanText(value: string | null | undefined, field: string, max: number, required = false): string | null {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  if (required && !cleaned) throw new Error(`${field} is required.`);
  if (cleaned.length > max) throw new Error(`${field} must be ${max} characters or fewer.`);
  return cleaned || null;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await db.auth.getUser();
  if (error || !data?.user?.id) throw new Error('Unable to verify your account.');
  return data.user.id;
}

function normalizeCreate(input: WishlistCreateInput) {
  return {
    title: cleanText(input.title, 'Title', MAX_TITLE_LENGTH, true) as string,
    description: cleanText(input.description, 'Description', MAX_DESCRIPTION_LENGTH, true) as string,
    category: cleanText(input.category, 'Category', MAX_CATEGORY_LENGTH),
  };
}

function normalizeStatus(status: WishlistStatus | undefined): WishlistStatus | undefined {
  if (status === undefined) return undefined;
  if (!STATUSES.includes(status)) throw new Error('Invalid wishlist status.');
  return status;
}

function throwQueryError(error: unknown, fallback: string): never {
  const message = error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message) : '';
  if (/row-level security|permission denied|not authorized/i.test(message)) throw new Error('You are not allowed to perform that action.');
  throw new Error(fallback);
}

export async function listMyWishlistItems(userId?: string): Promise<WishlistItem[]> {
  const ownerId = userId ?? await currentUserId();
  const { data, error } = await db.from('wishlist_items').select('*').eq('user_id', ownerId).order('created_at', { ascending: false });
  if (error) throwQueryError(error, 'Failed to load your wishlist.');
  return (data ?? []) as WishlistItem[];
}

export async function listAllWishlistItems(profile: Pick<UserProfile, 'role'>): Promise<WishlistItem[]> {
  if (profile.role !== 'admin') throw new Error('Admin access is required.');
  const { data, error } = await db
    .from('wishlist_items')
    .select('*, reporter:profiles!wishlist_items_user_id_fkey(id,full_name,email)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throwQueryError(error, 'Failed to load the wishlist queue.');
  return (data ?? []) as WishlistItem[];
}

export async function createWishlistItem(input: WishlistCreateInput, userId?: string): Promise<WishlistItem> {
  const ownerId = userId ?? await currentUserId();
  const values = normalizeCreate(input);
  const { data, error } = await db.from('wishlist_items').insert([{ user_id: ownerId, ...values, status: 'open' }]).select('*').single();
  if (error) throwQueryError(error, 'Failed to submit your wishlist idea.');
  return data as WishlistItem;
}

export async function updateWishlistItem(id: string, updates: WishlistUserUpdateInput, userId?: string): Promise<WishlistItem> {
  const ownerId = userId ?? await currentUserId();
  const values = {
    ...(updates.title !== undefined ? { title: cleanText(updates.title, 'Title', MAX_TITLE_LENGTH, true) } : {}),
    ...(updates.description !== undefined ? { description: cleanText(updates.description, 'Description', MAX_DESCRIPTION_LENGTH, true) } : {}),
    ...(updates.category !== undefined ? { category: cleanText(updates.category, 'Category', MAX_CATEGORY_LENGTH) } : {}),
  };
  const { data: existing, error: existingError } = await db.from('wishlist_items').select('status').eq('id', id).eq('user_id', ownerId).maybeSingle();
  if (existingError) throwQueryError(existingError, 'Failed to load your wishlist idea.');
  if (!existing) throw new Error('Wishlist idea not found.');
  if (existing.status !== 'open') throw new Error('Only open wishlist ideas can be edited.');
  const { data, error } = await db.from('wishlist_items').update(values).eq('id', id).eq('user_id', ownerId).select('*').single();
  if (error) throwQueryError(error, 'Failed to update your wishlist idea.');
  return data as WishlistItem;
}

export async function deleteWishlistItem(id: string, userId?: string): Promise<void> {
  const ownerId = userId ?? await currentUserId();
  const { data: existing, error: existingError } = await db.from('wishlist_items').select('status').eq('id', id).eq('user_id', ownerId).maybeSingle();
  if (existingError) throwQueryError(existingError, 'Failed to load your wishlist idea.');
  if (!existing) throw new Error('Wishlist idea not found.');
  if (existing.status !== 'open') throw new Error('Only open wishlist ideas can be deleted.');
  const { error } = await db.from('wishlist_items').delete().eq('id', id).eq('user_id', ownerId);
  if (error) throwQueryError(error, 'Failed to delete your wishlist idea.');
}

export async function adminUpdateWishlistItem(id: string, updates: WishlistAdminUpdateInput, profile: Pick<UserProfile, 'id' | 'role'>): Promise<WishlistItem> {
  if (profile.role !== 'admin') throw new Error('Admin access is required.');
  const status = normalizeStatus(updates.status);
  const adminNotes = updates.admin_notes === undefined ? undefined : cleanText(updates.admin_notes, 'Admin notes', MAX_ADMIN_NOTES_LENGTH);
  if (status === undefined && updates.admin_notes === undefined) throw new Error('No wishlist changes provided.');
  const values = {
    ...(status !== undefined ? { status } : {}),
    ...(updates.admin_notes !== undefined ? { admin_notes: adminNotes } : {}),
    updated_by: profile.id,
  };
  const { data, error } = await db.from('wishlist_items').update(values).eq('id', id).select('*').single();
  if (error) throwQueryError(error, 'Failed to update the wishlist idea.');
  return data as WishlistItem;
}
