import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';

const db = supabase as any;

export type VatType = 'vat_inclusive' | 'vat_exclusive';

export interface VatSettings {
  vat_rate: number;
}

export async function getVatSettings(): Promise<VatSettings> {
  const { data, error } = await db.from('system_vat_settings').select('vat_rate').single();
  if (error) throw error;
  return data as VatSettings;
}

export async function updateVatSettings(profile: UserProfile, vatRate: number): Promise<void> {
  const { error } = await db
    .from('system_vat_settings')
    .update({ vat_rate: vatRate, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) throw error;
}

export interface LineVatBreakdown {
  subtotal: number;
  vatAmount: number;
  total: number;
  vatType: VatType | null;
}

/**
 * Computes the subtotal/VAT/total split for one line.
 * - Not VAT-registered: no VAT math at all — total = subtotal = qty * unitPrice.
 * - VAT-exclusive: quoted price is the base; VAT is added on top.
 * - VAT-inclusive: quoted price IS the total; subtotal is derived by backing VAT out
 *   (display-only split — the total itself is never recomputed).
 */
export function computeLineVat(
  unitPrice: number,
  qty: number,
  isVatRegistered: boolean,
  vatType: VatType | null,
  vatRatePercent: number
): LineVatBreakdown {
  const raw = unitPrice * qty;

  if (!isVatRegistered) {
    return { subtotal: raw, vatAmount: 0, total: raw, vatType: null };
  }

  if (vatType === 'vat_inclusive') {
    const subtotal = raw / (1 + vatRatePercent / 100);
    return { subtotal, vatAmount: raw - subtotal, total: raw, vatType: 'vat_inclusive' };
  }

  // vat_exclusive (default treatment for a VAT-able line, including any legacy
  // row with no vat_type recorded — safest assumption is "add VAT on top")
  const vatAmount = raw * (vatRatePercent / 100);
  return { subtotal: raw, vatAmount, total: raw + vatAmount, vatType: 'vat_exclusive' };
}

/** Aggregates computeLineVat() across a list of already-priced lines. */
export function aggregateVat(
  lines: { unitPrice: number; qty: number; vatType: VatType | null; vatRateApplied: number | null }[]
): { subtotal: number; vatAmount: number; total: number } {
  return lines.reduce(
    (acc, l) => {
      const isVatRegistered = l.vatType !== null;
      const b = computeLineVat(l.unitPrice, l.qty, isVatRegistered, l.vatType, l.vatRateApplied ?? 0);
      return {
        subtotal: acc.subtotal + b.subtotal,
        vatAmount: acc.vatAmount + b.vatAmount,
        total: acc.total + b.total,
      };
    },
    { subtotal: 0, vatAmount: 0, total: 0 }
  );
}
