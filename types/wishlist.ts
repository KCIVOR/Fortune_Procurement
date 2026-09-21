import type { UserProfile } from '@/types/auth';

export type WishlistStatus = 'open' | 'planned' | 'in_progress' | 'completed' | 'declined';
export type WishlistCategory = string | null;

export interface WishlistItem {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: WishlistCategory;
  status: WishlistStatus;
  admin_notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  reporter?: Pick<UserProfile, 'id' | 'full_name' | 'email'> | null;
}

export interface WishlistCreateInput {
  title: string;
  description: string;
  category?: string | null;
}

export interface WishlistUserUpdateInput {
  title?: string;
  description?: string;
  category?: string | null;
}

export interface WishlistAdminUpdateInput {
  status?: WishlistStatus;
  admin_notes?: string | null;
}
