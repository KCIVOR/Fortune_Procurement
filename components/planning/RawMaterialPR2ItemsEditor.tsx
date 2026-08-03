'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDropdownOptions } from '@/hooks/useDropdownOptions';
import type { RawMaterialPR2ItemInput } from '@/lib/pr2-planning';
import type { PR2ItemAttachment } from '@/types/pr2';
import { PR2ItemAttachmentButton } from '@/components/planning/PR2ItemAttachmentsSection';

interface Props {
  items: RawMaterialPR2ItemInput[];
  onChange: (items: RawMaterialPR2ItemInput[]) => void;
  disabled?: boolean;
  /** Keyed by item.id (real id once saved, temp id before). Omit to hide the attach column. */
  existingAttachments?: Record<string, PR2ItemAttachment[]>;
  pendingFiles?: Record<string, File[]>;
  onAddFiles?: (itemKey: string, files: File[]) => void;
  onRemovePendingFile?: (itemKey: string, index: number) => void;
  onRemoveExistingAttachment?: (itemKey: string, att: PR2ItemAttachment) => void;
}

interface UnitState {
  sel: string;
  custom: string;
}

function resolveUnitSelection(stored: string, options: string[]): UnitState {
  if (!stored) return { sel: '', custom: '' };
  if (options.includes(stored) && stored !== 'Other') return { sel: stored, custom: '' };
  return { sel: 'Other', custom: stored };
}

function makeTempId(): string {
  return `temp-${Math.random().toString(36).substring(2, 9)}`;
}

function emptyItem(order: number): RawMaterialPR2ItemInput {
  return {
    id:                 makeTempId(),
    item_order:         order,
    item_code:          '',
    description:        '',
    unit_of_measure:    '',
    quantity_requested: 0,
    remarks:            '',
  };
}

export default function RawMaterialPR2ItemsEditor({
  items,
  onChange,
  disabled,
  existingAttachments,
  pendingFiles,
  onAddFiles,
  onRemovePendingFile,
  onRemoveExistingAttachment,
}: Props) {
  const { options: unitOpts } = useDropdownOptions('UNIT_OPTIONS');
  const unitValues = unitOpts.map((o) => o.option_value);
  const showAttachments = !!existingAttachments && !!onAddFiles && !!onRemovePendingFile && !!onRemoveExistingAttachment;

  const [unitStates, setUnitStates] = useState<UnitState[]>(() =>
    items.map((i) => resolveUnitSelection(i.unit_of_measure, unitValues))
  );

  // Re-resolve dropdown selection when options finish loading or the item count
  // changes (add/remove/load) — not on every keystroke, so typing a custom unit
  // doesn't get clobbered by a resync mid-edit.
  useEffect(() => {
    setUnitStates(items.map((i) => resolveUnitSelection(i.unit_of_measure, unitValues)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitValues.length, items.length]);

  const updateItem = (idx: number, patch: Partial<RawMaterialPR2ItemInput>) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const setUnitSel = (idx: number, sel: string) => {
    setUnitStates((prev) => prev.map((s, i) => (i === idx ? { sel, custom: '' } : s)));
    updateItem(idx, { unit_of_measure: sel === 'Other' ? '' : sel });
  };

  const setUnitCustom = (idx: number, custom: string) => {
    setUnitStates((prev) => prev.map((s, i) => (i === idx ? { ...s, custom } : s)));
    updateItem(idx, { unit_of_measure: custom });
  };

  const addItem = () => {
    onChange([...items, emptyItem(items.length + 1)]);
    setUnitStates((prev) => [...prev, { sel: '', custom: '' }]);
  };

  const removeItem = (idx: number) => {
    const next = items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, item_order: i + 1 }));
    onChange(next);
    setUnitStates((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const reordered = [...items];
    [reordered[idx], reordered[next]] = [reordered[next], reordered[idx]];
    onChange(reordered.map((it, i) => ({ ...it, item_order: i + 1 })));
    setUnitStates((prev) => {
      const states = [...prev];
      [states[idx], states[next]] = [states[next], states[idx]];
      return states;
    });
  };

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-pq-neutral-200">
        <h3 className="text-sm font-semibold text-pq-neutral-900">Line Items</h3>
        {!disabled && (
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-pq-primary-600 hover:text-pq-neutral-900 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Line
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-pq-neutral-200 bg-pq-neutral-50">
              <TableHead className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide w-10">#</TableHead>
              <TableHead className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide w-28">Item Code</TableHead>
              <TableHead className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Description</TableHead>
              <TableHead className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide w-36">Unit</TableHead>
              <TableHead className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide w-28">Qty</TableHead>
              {showAttachments && (
                <TableHead className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide w-20" title="Attach images to this item">Attach</TableHead>
              )}
              {!disabled && <TableHead className="px-4 py-2.5 w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-pq-neutral-200">
            {items.map((item, idx) => {
              const uState = unitStates[idx] ?? { sel: '', custom: '' };
              const itemKey = item.id ?? '';
              return (
                <TableRow key={idx} className="group">
                  <TableCell className="px-4 py-2 text-pq-neutral-500 align-middle">
                    {disabled ? (
                      idx + 1
                    ) : (
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveItem(idx, -1)}
                          disabled={idx === 0}
                          className="text-pq-neutral-400 hover:text-pq-neutral-500 disabled:opacity-0 transition"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <span className="text-xs text-pq-neutral-400 font-mono">{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === items.length - 1}
                          className="text-pq-neutral-400 hover:text-pq-neutral-500 disabled:opacity-0 transition"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <Input
                      value={item.item_code}
                      disabled={disabled}
                      onChange={(e) => updateItem(idx, { item_code: e.target.value })}
                      placeholder="Optional"
                      className="h-9 text-xs font-mono"
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <Input
                      value={item.description}
                      disabled={disabled}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      placeholder="Raw material description"
                      className="h-9 text-xs"
                    />
                    <Input
                      value={item.remarks ?? ''}
                      disabled={disabled}
                      onChange={(e) => updateItem(idx, { remarks: e.target.value })}
                      placeholder="Remarks (optional) — e.g. preferred brand, urgency note"
                      className="h-7 text-xs mt-1 text-pq-neutral-500 placeholder:text-pq-neutral-300"
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <select
                      value={uState.sel}
                      disabled={disabled}
                      onChange={(e) => setUnitSel(idx, e.target.value)}
                      className="w-full h-9 px-2.5 py-1.5 border border-pq-neutral-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] focus:border-pq-primary-600 transition bg-white appearance-none disabled:bg-pq-neutral-50 disabled:text-pq-neutral-500"
                    >
                      <option value="">— Unit —</option>
                      {unitValues.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {uState.sel === 'Other' && (
                      <Input
                        value={uState.custom}
                        disabled={disabled}
                        onChange={(e) => setUnitCustom(idx, e.target.value)}
                        placeholder="e.g. sack"
                        className="mt-1 h-8 text-xs"
                      />
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right">
                    <Input
                      type="number"
                      min={0}
                      value={item.quantity_requested}
                      disabled={disabled}
                      onChange={(e) => updateItem(idx, { quantity_requested: Number(e.target.value) })}
                      className="h-9 text-xs text-right"
                    />
                  </TableCell>
                  {showAttachments && (
                    <TableCell className="px-4 py-2 text-center">
                      <PR2ItemAttachmentButton
                        existingAttachments={existingAttachments![itemKey] ?? []}
                        pendingFiles={pendingFiles?.[itemKey] ?? []}
                        onAddFiles={(files) => onAddFiles!(itemKey, files)}
                        onRemovePendingFile={(pIdx) => onRemovePendingFile!(itemKey, pIdx)}
                        onRemoveExistingAttachment={(att) => onRemoveExistingAttachment!(itemKey, att)}
                      />
                    </TableCell>
                  )}
                  {!disabled && (
                    <TableCell className="px-4 py-2 text-right">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-pq-neutral-400 hover:text-pq-danger-600 transition opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
