'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Upload, CheckCircle2, XCircle, FileSpreadsheet, X, Download,
  AlertTriangle, ChevronRight, Copy, Check,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  parseRawFile,
  autoDetectMapping,
  applyColumnMapping,
  normMatch,
  type ColumnMapping,
  type UserImportRow,
} from '@/lib/user-import-parser';
import { cn } from '@/lib/utils';

interface BulkImportUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string; role_id: string | null }>;
  roles: Array<{ id: string; name: string }>;
  onImportComplete?: () => void;
}

interface ResolvedRow {
  email: string;
  full_name: string;
  department_id: string;
  position_id: string;
}

interface RowDetail {
  email: string;
  full_name: string;
  status: 'success' | 'failed';
  error?: string;
  temp_password?: string;
}

interface ImportResult {
  summary: { total: number; succeeded: number; failed: number };
  details: RowDetail[];
}

type Step = 'upload' | 'mapping' | 'review' | 'importing' | 'results';

const MODAL_SHELL =
  'flex flex-col gap-0 p-0 overflow-hidden w-[calc(100%-1rem)] max-w-3xl max-h-[min(92dvh,900px)] sm:rounded-lg';
const SCROLL_BODY = 'flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4';
const FOOTER =
  'shrink-0 border-t border-pq-neutral-100 bg-pq-white px-4 sm:px-6 py-3 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]';

const STEP_TITLES: Record<Step, string> = {
  upload:    'Bulk Import Users',
  mapping:   'Map Columns',
  review:    'Review & Resolve',
  importing: 'Bulk Import Users',
  results:   'Import Complete',
};

const SYSTEM_FIELDS = [
  { key: 'email'      as const, label: 'Email',      required: true },
  { key: 'full_name'  as const, label: 'Full Name',  required: true },
  { key: 'department' as const, label: 'Department', required: true },
  { key: 'position'   as const, label: 'Position',   required: true },
] satisfies { key: keyof ColumnMapping; label: string; required: boolean }[];

const MAX_IMPORT_ROWS = 500;

function downloadTemplate() {
  const csv = 'Full Name,Email,Department,Position\nJuan Dela Cruz,juan.delacruz@example.com,Procurement,Procurement Staff\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'user_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function StepPill({ current, step }: { current: Step; step: Step }) {
  const steps: Step[] = ['upload', 'mapping', 'review', 'results'];
  const idx    = steps.indexOf(step);
  const curIdx = steps.indexOf(current === 'importing' ? 'results' : current);
  const done   = curIdx > idx;
  const active = curIdx === idx;

  return (
    <div className={cn(
      'flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide transition',
      active ? 'text-pq-primary-600' : done ? 'text-pq-success-600' : 'text-pq-neutral-400',
    )}>
      <span className={cn(
        'w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border',
        active ? 'bg-pq-primary-600 border-pq-primary-600 text-white'
          : done ? 'bg-pq-success-600 border-pq-success-600 text-white'
          : 'border-pq-neutral-300 text-pq-neutral-400',
      )}>
        {done ? '✓' : idx + 1}
      </span>
      {step === 'upload' ? 'Upload' : step === 'mapping' ? 'Map' : step === 'review' ? 'Review' : 'Done'}
    </div>
  );
}

export default function BulkImportUsersModal({
  isOpen,
  onClose,
  departments,
  positions,
  roles,
  onImportComplete,
}: BulkImportUsersModalProps) {
  const { session } = useAuth();

  const [step, setStep] = useState<Step>('upload');

  // upload
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // mapping
  const EMPTY_MAPPING: ColumnMapping = { email: '', full_name: '', department: '', position: '' };
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);

  // per-row manual overrides keyed by row index (set when auto-match fails or user changes it)
  const [deptOverride, setDeptOverride] = useState<Record<number, string>>({});
  const [posOverride, setPosOverride] = useState<Record<number, string>>({});

  // import
  const [importing, setImporting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const mappedRows: UserImportRow[] = useMemo(
    () => applyColumnMapping(rawRows, mapping),
    [rawRows, mapping],
  );

  const deptByNorm = useMemo(() => {
    const m = new Map<string, string>();
    departments.forEach(d => m.set(normMatch(d.name), d.id));
    return m;
  }, [departments]);

  const posByNorm = useMemo(() => {
    const m = new Map<string, string>();
    positions.forEach(p => m.set(normMatch(p.title), p.id));
    return m;
  }, [positions]);

  const roleById = useMemo(() => {
    const m = new Map<string, string>();
    roles.forEach(r => m.set(r.id, r.name));
    return m;
  }, [roles]);

  const positionRoleName = (positionId: string): string => {
    const pos = positions.find(p => p.id === positionId);
    if (!pos?.role_id) return '—';
    return roleById.get(pos.role_id) ?? '—';
  };

  // resolved department/position id per row (auto-match, or manual override)
  const resolvedRows = useMemo(() => {
    return mappedRows.map((row, i) => {
      const deptId = deptOverride[i] ?? deptByNorm.get(normMatch(row.department)) ?? '';
      const posId  = posOverride[i]  ?? posByNorm.get(normMatch(row.position))    ?? '';
      return { row, deptId, posId };
    });
  }, [mappedRows, deptOverride, posOverride, deptByNorm, posByNorm]);

  const unresolvedCount = resolvedRows.filter(r => !r.deptId || !r.posId).length;
  const overLimit = mappedRows.length > MAX_IMPORT_ROWS;
  const canImport = mappedRows.length > 0 && !overLimit && unresolvedCount === 0;

  const canProceedToReview =
    mapping.email !== '' && mapping.full_name !== '' &&
    mapping.department !== '' && mapping.position !== '' &&
    mappedRows.length > 0 && !overLimit;

  // ── File handling ──────────────────────────────────────────────────────────

  const processFile = useCallback(async (f: File) => {
    setFile(f);
    setParseError('');
    setHeaders([]);
    setRawRows([]);
    setIsParsing(true);
    try {
      const raw = await parseRawFile(f);
      if (raw.error) { setParseError(raw.error); return; }
      setHeaders(raw.headers);
      setRawRows(raw.rawRows);
      setMapping(autoDetectMapping(raw.headers));
      setDeptOverride({});
      setPosOverride({});
      setStep('mapping');
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  };

  const handleChangeFile = () => {
    setFile(null);
    setHeaders([]);
    setRawRows([]);
    setParseError('');
    setMapping(EMPTY_MAPPING);
    setDeptOverride({});
    setPosOverride({});
    setSubmitError('');
    setStep('upload');
  };

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!canImport || !session) return;
    setImporting(true);
    setSubmitError('');
    setStep('importing');

    const payloadRows: ResolvedRow[] = resolvedRows.map(({ row, deptId, posId }) => ({
      email: row.email,
      full_name: row.full_name,
      department_id: deptId,
      position_id: posId,
    }));

    try {
      const res = await fetch('/api/admin/users/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ rows: payloadRows }),
      });

      let data: Record<string, unknown> = {};
      try {
        const text = await res.text();
        if (text) data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid server response (HTTP ${res.status}).`);
      }

      if (!res.ok || data.success === false) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Import failed.');
      }

      setResult({
        summary: data.summary as ImportResult['summary'],
        details: data.details as RowDetail[],
      });
      setStep('results');
      onImportComplete?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error.');
      setStep('review');
    } finally {
      setImporting(false);
    }
  };

  // ── Reset / close ──────────────────────────────────────────────────────────

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setHeaders([]);
    setRawRows([]);
    setParseError('');
    setIsParsing(false);
    setIsDragging(false);
    setMapping(EMPTY_MAPPING);
    setDeptOverride({});
    setPosOverride({});
    setImporting(false);
    setSubmitError('');
    setResult(null);
    onClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className={MODAL_SHELL}>

        {/* Header */}
        <DialogHeader className="shrink-0 px-4 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-pq-neutral-100 text-left">
          <div className="flex items-center justify-between">
            <DialogTitle className="pr-8 text-base sm:text-lg leading-snug">
              {STEP_TITLES[step]}
            </DialogTitle>
            {step !== 'results' && step !== 'importing' && (
              <div className="flex items-center gap-2 shrink-0">
                <StepPill current={step} step="upload" />
                <ChevronRight className="w-3 h-3 text-pq-neutral-300" />
                <StepPill current={step} step="mapping" />
                <ChevronRight className="w-3 h-3 text-pq-neutral-300" />
                <StepPill current={step} step="review" />
              </div>
            )}
          </div>
        </DialogHeader>

        {/* ── Step: Upload ──────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className={SCROLL_BODY}>
              <div className="space-y-5">

                <div className="flex items-center justify-between">
                  <p className="text-xs text-pq-neutral-500">
                    Upload any <span className="font-medium">.csv</span>, <span className="font-medium">.xlsx</span>,
                    or <span className="font-medium">.xls</span> file — you&apos;ll map columns and resolve
                    department/position next. Max <span className="font-medium text-pq-neutral-700">500 rows</span> per import.
                  </p>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="inline-flex items-center gap-1.5 text-xs text-pq-primary-600 hover:text-pq-neutral-900 font-medium shrink-0 ml-3 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Template
                  </button>
                </div>

                {parseError && (
                  <div className="flex items-start gap-2 bg-pq-danger-50 border border-pq-danger-200 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-pq-danger-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-pq-danger-700">{file?.name}</p>
                      <p className="text-xs text-pq-danger-600 mt-0.5">{parseError}</p>
                    </div>
                    <button type="button" onClick={() => { setFile(null); setParseError(''); }} className="p-1 text-pq-neutral-400 hover:text-pq-neutral-700 shrink-0 transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => !isParsing && fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-lg px-6 py-12 flex flex-col items-center gap-3 transition',
                    isParsing
                      ? 'border-pq-primary-300 bg-pq-primary-50 cursor-wait'
                      : isDragging
                        ? 'border-pq-primary-400 bg-pq-primary-50 cursor-copy'
                        : 'border-pq-neutral-200 hover:border-pq-primary-300 hover:bg-pq-neutral-50 cursor-pointer',
                  )}
                >
                  {isParsing ? (
                    <>
                      <span className="w-6 h-6 border-2 border-pq-primary-200 border-t-pq-primary-600 rounded-full animate-spin" />
                      <p className="text-sm font-medium text-pq-primary-700">Reading file…</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-pq-neutral-400" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-pq-neutral-700">
                          {isDragging ? 'Drop file here' : 'Click or drag & drop to upload'}
                        </p>
                        <p className="text-xs text-pq-neutral-400 mt-0.5">CSV, XLS, or XLSX</p>
                      </div>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

              </div>
            </div>

            <div className={FOOTER}>
              <Button type="button" variant="outline" onClick={handleClose} className="w-full">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Mapping ─────────────────────────────────────────────────── */}
        {step === 'mapping' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className={SCROLL_BODY}>
              <div className="space-y-5">

                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-pq-neutral-50 border border-pq-neutral-200">
                  <FileSpreadsheet className="w-4 h-4 text-pq-neutral-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-pq-neutral-900 truncate">{file?.name}</p>
                    <p className="text-[10px] text-pq-neutral-500 mt-0.5">
                      {rawRows.length} row{rawRows.length !== 1 ? 's' : ''} · {headers.length} column{headers.length !== 1 ? 's' : ''} detected
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleChangeFile}
                    className="text-xs text-pq-primary-600 hover:text-pq-neutral-900 font-medium shrink-0 transition"
                  >
                    Change file
                  </button>
                </div>

                {overLimit && (
                  <div className="flex items-start gap-2 bg-pq-warning-50 border border-pq-warning-200 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-pq-warning-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-pq-warning-700">
                      <span className="font-semibold">Too many rows.</span> This file has {mappedRows.length} users — the limit is {MAX_IMPORT_ROWS} per import.
                      Split the file and import in batches.
                    </p>
                  </div>
                )}

                <div className="rounded-lg border border-pq-neutral-200 overflow-hidden">
                  <div className="grid grid-cols-2 px-4 py-2 bg-pq-neutral-50 border-b border-pq-neutral-200 gap-4">
                    <span className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">System Field</span>
                    <span className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">Your File Column</span>
                  </div>
                  <div className="divide-y divide-pq-neutral-200">
                    {SYSTEM_FIELDS.map(field => {
                      const isMapped = mapping[field.key] !== '';
                      return (
                        <div key={field.key} className="grid grid-cols-2 items-center gap-4 px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-pq-neutral-800">{field.label}</span>
                            <span className="text-[10px] font-bold text-pq-danger-600">*</span>
                          </div>
                          <div className="relative">
                            <select
                              value={mapping[field.key]}
                              onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                              className={cn(
                                'w-full appearance-none text-xs border rounded-md pl-2.5 pr-7 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-pq-primary-400 transition',
                                isMapped ? 'border-pq-neutral-300 text-pq-neutral-900' : 'border-pq-danger-200 text-pq-neutral-400',
                              )}
                            >
                              <option value="">— Select column —</option>
                              {headers.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                            <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-pq-neutral-400 rotate-90 pointer-events-none" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-xs text-pq-neutral-400">
                  {mappedRows.length} row{mappedRows.length !== 1 ? 's' : ''} will be imported. Department and Position
                  text values will be matched against existing system records in the next step.
                </p>

              </div>
            </div>

            <div className={FOOTER}>
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={handleChangeFile} className="flex-1 w-full">
                  ← Change File
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep('review')}
                  disabled={!canProceedToReview}
                  className="flex-1 w-full bg-pq-primary-600 hover:bg-pq-neutral-900 text-white"
                >
                  Continue to Review
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: Review ──────────────────────────────────────────────────── */}
        {step === 'review' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className={SCROLL_BODY}>
              <div className="space-y-4">

                {submitError && (
                  <div className="flex items-start gap-2 bg-pq-danger-50 border border-pq-danger-200 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-pq-danger-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-pq-danger-600">{submitError}</p>
                  </div>
                )}

                {unresolvedCount > 0 ? (
                  <div className="flex items-start gap-2 bg-pq-warning-50 border border-pq-warning-200 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-pq-warning-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-pq-warning-700">
                      <span className="font-semibold">{unresolvedCount} row{unresolvedCount !== 1 ? 's' : ''}</span> couldn&apos;t
                      be matched to an existing department or position. Pick a value manually below for each highlighted row.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-pq-success-50 border border-pq-success-200 rounded-lg p-3">
                    <CheckCircle2 className="w-4 h-4 text-pq-success-600 shrink-0" />
                    <p className="text-xs text-pq-success-700 font-medium">
                      All {mappedRows.length} row{mappedRows.length !== 1 ? 's' : ''} matched. Each user will get a unique
                      auto-generated password shown after import.
                    </p>
                  </div>
                )}

                <div className="rounded-lg border border-pq-neutral-200 overflow-hidden">
                  <div className="grid grid-cols-[1.4fr_1.4fr_1.3fr_1.3fr] px-4 py-2 bg-pq-neutral-50 border-b border-pq-neutral-200 gap-2">
                    <span className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">Name / Email</span>
                    <span className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">From file</span>
                    <span className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">Department</span>
                    <span className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">Position</span>
                  </div>
                  <div className="divide-y divide-pq-neutral-200 max-h-[380px] overflow-y-auto">
                    {resolvedRows.map(({ row, deptId, posId }, i) => {
                      const rowUnresolved = !deptId || !posId;
                      return (
                        <div
                          key={i}
                          className={cn(
                            'grid grid-cols-[1.4fr_1.4fr_1.3fr_1.3fr] items-center gap-2 px-4 py-2.5',
                            rowUnresolved && 'bg-pq-warning-50',
                          )}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-pq-neutral-900 truncate">{row.full_name || '—'}</p>
                            <p className="text-[10px] font-mono text-pq-neutral-500 truncate">{row.email || '—'}</p>
                          </div>
                          <div className="min-w-0 text-[10px] text-pq-neutral-500 truncate">
                            <p className="truncate">{row.department || '—'}</p>
                            <p className="truncate">{row.position || '—'}</p>
                          </div>
                          <select
                            value={deptId}
                            onChange={e => setDeptOverride(m => ({ ...m, [i]: e.target.value }))}
                            className={cn(
                              'text-xs border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-pq-primary-400 transition min-w-0',
                              deptId ? 'border-pq-neutral-300' : 'border-pq-danger-300 text-pq-neutral-400',
                            )}
                          >
                            <option value="">— Select —</option>
                            {departments.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          <select
                            value={posId}
                            onChange={e => setPosOverride(m => ({ ...m, [i]: e.target.value }))}
                            className={cn(
                              'text-xs border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-pq-primary-400 transition min-w-0',
                              posId ? 'border-pq-neutral-300' : 'border-pq-danger-300 text-pq-neutral-400',
                            )}
                          >
                            <option value="">— Select —</option>
                            {positions.map(p => (
                              <option key={p.id} value={p.id}>{p.title} ({positionRoleName(p.id)})</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

            <div className={FOOTER}>
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => setStep('mapping')} disabled={importing} className="flex-1 w-full">
                  ← Back to Mapping
                </Button>
                <Button
                  type="button"
                  onClick={handleImport}
                  disabled={!canImport || importing}
                  className="flex-1 w-full bg-pq-primary-600 hover:bg-pq-neutral-900 text-white"
                >
                  {mappedRows.length > 0
                    ? `Import ${mappedRows.length} User${mappedRows.length !== 1 ? 's' : ''}`
                    : 'Import'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: Importing ───────────────────────────────────────────────── */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3">
            <span className="w-9 h-9 border-4 border-pq-neutral-200 border-t-pq-primary-600 rounded-full animate-spin" />
            <p className="text-sm font-medium text-pq-neutral-700">Importing users…</p>
            <p className="text-xs text-pq-neutral-400">Processing {mappedRows.length} row{mappedRows.length !== 1 ? 's' : ''}. Please wait.</p>
          </div>
        )}

        {/* ── Step: Results ─────────────────────────────────────────────────── */}
        {step === 'results' && result && (
          <ResultsView result={result} onClose={handleClose} scrollBody={SCROLL_BODY} footer={FOOTER} />
        )}

      </DialogContent>
    </Dialog>
  );
}

// ─── Results view ─────────────────────────────────────────────────────────────

function ResultsView({
  result,
  onClose,
  scrollBody,
  footer,
}: {
  result: ImportResult;
  onClose: () => void;
  scrollBody: string;
  footer: string;
}) {
  const { summary, details } = result;
  const allSucceeded = summary.failed === 0;
  const allFailed    = summary.succeeded === 0;
  const [copiedAll, setCopiedAll] = useState(false);

  function downloadCredentials() {
    const rows = details.filter(d => d.status === 'success' && d.temp_password);
    const csv = 'full_name,email,temp_password\n' +
      rows.map(r => `"${r.full_name.replace(/"/g, '""')}",${r.email},${r.temp_password}`).join('\n') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'imported_users_credentials.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyAllCredentials() {
    const rows = details.filter(d => d.status === 'success' && d.temp_password);
    const text = rows.map(r => `${r.email}\t${r.temp_password}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className={scrollBody}>
        <div className="space-y-4">

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-pq-neutral-200 bg-pq-neutral-50 p-3 text-center">
              <p className="text-2xl font-bold text-pq-neutral-900">{summary.total}</p>
              <p className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide mt-0.5">Total</p>
            </div>
            <div className={cn('rounded-lg border p-3 text-center',
              summary.succeeded > 0 ? 'border-pq-success-200 bg-pq-success-50' : 'border-pq-neutral-200 bg-pq-neutral-50')}>
              <p className={cn('text-2xl font-bold', summary.succeeded > 0 ? 'text-pq-success-700' : 'text-pq-neutral-400')}>
                {summary.succeeded}
              </p>
              <p className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide mt-0.5">Imported</p>
            </div>
            <div className={cn('rounded-lg border p-3 text-center',
              summary.failed > 0 ? 'border-pq-danger-200 bg-pq-danger-50' : 'border-pq-neutral-200 bg-pq-neutral-50')}>
              <p className={cn('text-2xl font-bold', summary.failed > 0 ? 'text-pq-danger-600' : 'text-pq-neutral-400')}>
                {summary.failed}
              </p>
              <p className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide mt-0.5">Failed</p>
            </div>
          </div>

          {allSucceeded && (
            <div className="flex items-center gap-2 bg-pq-success-50 border border-pq-success-200 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 text-pq-success-600 shrink-0" />
              <p className="text-sm text-pq-success-700 font-medium">All users imported successfully.</p>
            </div>
          )}
          {allFailed && (
            <div className="flex items-center gap-2 bg-pq-danger-50 border border-pq-danger-200 rounded-lg p-3">
              <XCircle className="w-4 h-4 text-pq-danger-600 shrink-0" />
              <p className="text-sm text-pq-danger-600 font-medium">All rows failed. No accounts were created.</p>
            </div>
          )}
          {!allSucceeded && !allFailed && (
            <div className="flex items-center gap-2 bg-pq-warning-50 border border-pq-warning-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-pq-warning-600 shrink-0" />
              <p className="text-sm text-pq-warning-700 font-medium">
                Partial import — {summary.failed} row{summary.failed !== 1 ? 's' : ''} skipped.
              </p>
            </div>
          )}

          {summary.succeeded > 0 && (
            <div className="bg-pq-primary-50 border border-pq-primary-200 rounded-lg p-3 space-y-2">
              <p className="text-xs text-pq-primary-700">
                <strong>Each imported user got a unique temporary password.</strong> Passwords are shown only now
                and cannot be recovered later — download or copy them before closing this window.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={downloadCredentials} className="text-xs">
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download CSV
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={copyAllCredentials} className="text-xs">
                  {copiedAll ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                  {copiedAll ? 'Copied!' : 'Copy All'}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-pq-neutral-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-pq-neutral-50 border-b border-pq-neutral-200">
              <p className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">Row Details</p>
            </div>
            <ul className="divide-y divide-pq-neutral-200">
              {details.map((row, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3">
                  {row.status === 'success'
                    ? <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
                    : <XCircle className="w-4 h-4 text-pq-danger-600 mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-pq-neutral-900 truncate">{row.full_name}</p>
                    <p className="text-xs font-mono text-pq-neutral-500 truncate">{row.email}</p>
                    {row.error && <p className="text-xs text-pq-danger-600 mt-0.5">{row.error}</p>}
                    {row.temp_password && (
                      <p className="text-xs font-mono text-pq-neutral-700 mt-0.5">{row.temp_password}</p>
                    )}
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-wide shrink-0 mt-0.5',
                    row.status === 'success' ? 'text-pq-success-600' : 'text-pq-danger-600',
                  )}>
                    {row.status === 'success' ? 'OK' : 'Failed'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      <div className={footer}>
        <Button type="button" onClick={onClose} className="w-full bg-pq-primary-600 hover:bg-pq-neutral-900 text-white">
          Done
        </Button>
      </div>
    </div>
  );
}
