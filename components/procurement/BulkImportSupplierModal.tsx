'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Upload, Eye, EyeOff, RefreshCw, CheckCircle2, XCircle,
  FileSpreadsheet, X, Download, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  parseRawFile,
  autoDetectMapping,
  applyColumnMapping,
  type ColumnMapping,
  type SupplierImportRow,
} from '@/lib/supplier-import-parser';
import { cn } from '@/lib/utils';

interface BulkImportSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

interface RowDetail {
  email: string;
  full_name: string;
  status: 'success' | 'failed';
  error?: string;
}

interface ImportResult {
  summary: { total: number; succeeded: number; failed: number };
  details: RowDetail[];
}

type Step = 'upload' | 'mapping' | 'importing' | 'results';

const MODAL_SHELL =
  'flex flex-col gap-0 p-0 overflow-hidden w-[calc(100%-1rem)] max-w-2xl max-h-[min(92dvh,880px)] sm:rounded-lg';
const SCROLL_BODY = 'flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4';
const FOOTER =
  'shrink-0 border-t border-pq-neutral-100 bg-pq-white px-4 sm:px-6 py-3 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]';

const STEP_TITLES: Record<Step, string> = {
  upload:    'Bulk Import Suppliers',
  mapping:   'Map Columns',
  importing: 'Bulk Import Suppliers',
  results:   'Import Complete',
};

const SYSTEM_FIELDS = [
  { key: 'email'         as const, label: 'Email',           required: true  },
  { key: 'full_name'     as const, label: 'Supplier Name',   required: true  },
  { key: 'payment_terms' as const, label: 'Payment Terms',   required: false },
] satisfies { key: keyof ColumnMapping; label: string; required: boolean }[];

function generatePassword(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let pw = '';
  for (let i = 0; i < 16; i++) pw += charset.charAt(Math.floor(Math.random() * charset.length));
  return pw;
}

function downloadTemplate() {
  const csv = 'email,full_name,payment_terms\nvendor@example.com,Ace Supply Corp,30 days net\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'supplier_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepPill({ current, step }: { current: Step; step: Step }) {
  const steps: Step[] = ['upload', 'mapping', 'results'];
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
      {step === 'upload' ? 'Upload' : step === 'mapping' ? 'Map' : 'Done'}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function BulkImportSupplierModal({
  isOpen,
  onClose,
  onImportComplete,
}: BulkImportSupplierModalProps) {
  const { session } = useAuth();

  const [step,       setStep]       = useState<Step>('upload');

  // upload
  const [file,       setFile]       = useState<File | null>(null);
  const [headers,    setHeaders]    = useState<string[]>([]);
  const [rawRows,    setRawRows]    = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState('');
  const [isParsing,  setIsParsing]  = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // mapping + password
  const EMPTY_MAPPING: ColumnMapping = { email: '', full_name: '', payment_terms: '' };
  const [mapping,      setMapping]      = useState<ColumnMapping>(EMPTY_MAPPING);
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // import
  const [importing,    setImporting]    = useState(false);
  const [submitError,  setSubmitError]  = useState('');
  const [result,       setResult]       = useState<ImportResult | null>(null);

  // derived
  const MAX_IMPORT_ROWS = 500;

  const mappedRows: SupplierImportRow[] = useMemo(
    () => applyColumnMapping(rawRows, mapping),
    [rawRows, mapping],
  );
  const previewRows    = mappedRows.slice(0, 3);
  const overLimit      = mappedRows.length > MAX_IMPORT_ROWS;
  const canImport      = mapping.email !== '' && mapping.full_name !== '' && password.length >= 8 && mappedRows.length > 0 && !overLimit;

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
    setSubmitError('');
    setStep('upload');
  };

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!canImport || !session) return;
    setImporting(true);
    setSubmitError('');
    setStep('importing');

    try {
      const res = await fetch('/api/procurement/suppliers/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ rows: mappedRows, password }),
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
      setStep('mapping');
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
    setPassword('');
    setShowPassword(false);
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
                <StepPill current={step} step="results" />
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
                    or <span className="font-medium">.xls</span> file — you'll map columns in the next step.
                    Max <span className="font-medium text-pq-neutral-700">500 rows</span> per import.
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

                {/* Error from prior parse attempt */}
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

                {/* Drop zone */}
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

                {/* File info bar */}
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

                {/* Over-limit warning */}
                {overLimit && (
                  <div className="flex items-start gap-2 bg-pq-warning-50 border border-pq-warning-200 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-pq-warning-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-pq-warning-700">
                      <span className="font-semibold">Too many rows.</span> This file has {mappedRows.length} suppliers — the limit is {MAX_IMPORT_ROWS} per import.
                      Split the file and import in batches.
                    </p>
                  </div>
                )}

                {/* Submit error from failed import attempt */}
                {submitError && (
                  <div className="flex items-start gap-2 bg-pq-danger-50 border border-pq-danger-200 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-pq-danger-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-pq-danger-600">{submitError}</p>
                  </div>
                )}

                {/* Column mapping table */}
                <div className="rounded-lg border border-pq-neutral-200 overflow-hidden">
                  <div className="grid grid-cols-2 px-4 py-2 bg-pq-neutral-50 border-b border-pq-neutral-200 gap-4">
                    <span className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">System Field</span>
                    <span className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">Your File Column</span>
                  </div>
                  <div className="divide-y divide-pq-neutral-200">
                    {SYSTEM_FIELDS.map(field => {
                      const isMapped = mapping[field.key] !== '';
                      const isRequired = field.required;
                      return (
                        <div key={field.key} className="grid grid-cols-2 items-center gap-4 px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-pq-neutral-800">{field.label}</span>
                            {isRequired && (
                              <span className="text-[10px] font-bold text-pq-danger-600">*</span>
                            )}
                            {!isRequired && (
                              <span className="text-[10px] text-pq-neutral-400 italic">optional</span>
                            )}
                          </div>
                          <div className="relative">
                            <select
                              value={mapping[field.key]}
                              onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                              className={cn(
                                'w-full appearance-none text-xs border rounded-md pl-2.5 pr-7 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-pq-primary-400 transition',
                                isMapped
                                  ? 'border-pq-neutral-300 text-pq-neutral-900'
                                  : isRequired
                                    ? 'border-pq-danger-200 text-pq-neutral-400'
                                    : 'border-pq-neutral-200 text-pq-neutral-400',
                              )}
                            >
                              <option value="">{isRequired ? '— Select column —' : '— Not mapped —'}</option>
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

                {/* Live preview */}
                {previewRows.length > 0 && (
                  <div className="rounded-lg border border-pq-neutral-200 overflow-hidden">
                    <div className="px-4 py-2 bg-pq-neutral-50 border-b border-pq-neutral-200 flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">
                        Preview
                      </p>
                      <p className="text-[10px] text-pq-neutral-400">
                        {previewRows.length} of {mappedRows.length} row{mappedRows.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-pq-neutral-50 border-b border-pq-neutral-200">
                            <th className="text-left px-3 py-2 font-semibold text-pq-neutral-500">Email</th>
                            <th className="text-left px-3 py-2 font-semibold text-pq-neutral-500">Supplier Name</th>
                            <th className="text-left px-3 py-2 font-semibold text-pq-neutral-500">Payment Terms</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-pq-neutral-200">
                          {previewRows.map((row, i) => (
                            <tr key={i} className="hover:bg-pq-neutral-50/60">
                              <td className="px-3 py-2 font-mono text-pq-neutral-700">
                                {row.email || <span className="italic text-pq-neutral-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-pq-neutral-900">
                                {row.full_name || <span className="italic text-pq-neutral-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-pq-neutral-500">
                                {row.payment_terms || <span className="italic text-pq-neutral-300">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {mappedRows.length > 3 && (
                      <div className="px-3 py-1.5 border-t border-pq-neutral-200 bg-pq-neutral-50">
                        <p className="text-[10px] text-pq-neutral-400">
                          + {mappedRows.length - 3} more row{mappedRows.length - 3 !== 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-pq-neutral-200" />

                {/* Shared password */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-pq-neutral-500">
                    Shared Password{' '}
                    <span className="text-pq-neutral-400 font-normal">(applied to all accounts)</span>
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative min-w-0">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        disabled={importing}
                        className="text-sm pr-10 w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-pq-neutral-500 hover:text-pq-neutral-900 transition"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPassword(generatePassword())}
                      disabled={importing}
                      aria-label="Generate random password"
                      className="shrink-0"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-pq-neutral-400">
                    {password.length === 0
                      ? 'All imported suppliers will log in with this password.'
                      : password.length < 8
                        ? `${password.length} characters — minimum 8 required`
                        : `${password.length} characters`}
                  </p>
                </div>

              </div>
            </div>

            <div className={FOOTER}>
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleChangeFile}
                  disabled={importing}
                  className="flex-1 w-full"
                >
                  ← Change File
                </Button>
                <Button
                  type="button"
                  onClick={handleImport}
                  disabled={!canImport || importing}
                  className="flex-1 w-full bg-pq-primary-600 hover:bg-pq-neutral-900 text-white"
                >
                  {mappedRows.length > 0
                    ? `Import ${mappedRows.length} Supplier${mappedRows.length !== 1 ? 's' : ''}`
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
            <p className="text-sm font-medium text-pq-neutral-700">Importing suppliers…</p>
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

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className={scrollBody}>
        <div className="space-y-4">

          {/* Summary cards */}
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

          {/* Banner */}
          {allSucceeded && (
            <div className="flex items-center gap-2 bg-pq-success-50 border border-pq-success-200 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 text-pq-success-600 shrink-0" />
              <p className="text-sm text-pq-success-700 font-medium">All suppliers imported successfully.</p>
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

          {/* Per-row list */}
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
