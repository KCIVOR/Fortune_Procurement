import { supabase } from '@/lib/supabase';
import type { DropdownCategory, DropdownOption } from '@/types/dropdown-options';

const db = supabase as any;

// ── Public reads ──────────────────────────────────────────────────────────────

/** Fetch active options for a given category, ordered by sort_order. */
export async function fetchDropdownOptions(
  category: DropdownCategory,
): Promise<DropdownOption[]> {
  const { data, error } = await db
    .from('system_dropdown_options')
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DropdownOption[];
}

/** Fetch ALL options for a category (including inactive) — admin view. */
export async function fetchAllDropdownOptions(
  category: DropdownCategory,
): Promise<DropdownOption[]> {
  const { data, error } = await db
    .from('system_dropdown_options')
    .select('*')
    .eq('category', category)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DropdownOption[];
}

// ── Admin mutations ───────────────────────────────────────────────────────────

/** Create a new dropdown option. */
export async function createDropdownOption(
  category: DropdownCategory,
  optionValue: string,
  optionLabel: string,
  sortOrder: number,
): Promise<DropdownOption> {
  const { data, error } = await db
    .from('system_dropdown_options')
    .insert({
      category,
      option_value: optionValue,
      option_label: optionLabel,
      sort_order: sortOrder,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as DropdownOption;
}

/** Update an existing dropdown option (label, sort_order, or is_active). */
export async function updateDropdownOption(
  id: string,
  updates: {
    option_label?: string;
    sort_order?: number;
    is_active?: boolean;
  },
): Promise<void> {
  const { error } = await db
    .from('system_dropdown_options')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Permanently delete a dropdown option. */
export async function deleteDropdownOption(id: string): Promise<void> {
  const { error } = await db
    .from('system_dropdown_options')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/** Batch-update sort orders for a category. `orderedIds` is the desired order. */
export async function reorderDropdownOptions(
  orderedIds: string[],
): Promise<void> {
  // Run updates sequentially — low volume, acceptable performance.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await db
      .from('system_dropdown_options')
      .update({ sort_order: i + 1, updated_at: new Date().toISOString() })
      .eq('id', orderedIds[i]);
    if (error) throw error;
  }
}
