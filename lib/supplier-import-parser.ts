import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ─── Shared row type ──────────────────────────────────────────────────────────

export interface SupplierImportRow {
  email: string;
  full_name: string;
  payment_terms?: string;
}

// ─── Dynamic import types ─────────────────────────────────────────────────────

export interface RawParseResult {
  headers: string[];
  rawRows: Record<string, string>[];
  error?: string;
}

export interface ColumnMapping {
  email: string;         // file column header, '' = not mapped
  full_name: string;
  payment_terms: string; // optional field — '' means skip
}

// ─── Auto-detect ─────────────────────────────────────────────────────────────

const EMAIL_ALIASES = [
  'email', 'email_address', 'emailaddress', 'e_mail', 'e-mail',
  'supplier_email', 'contact_email', 'mail',
];
const NAME_ALIASES = [
  'full_name', 'fullname', 'name', 'company_name', 'companyname',
  'supplier_name', 'suppliername', 'company', 'supplier',
  'vendor', 'vendor_name', 'vendorname', 'business_name',
];
const TERMS_ALIASES = [
  'payment_terms', 'paymentterms', 'terms', 'payment', 'pay_terms',
  'payterms', 'payment_condition', 'credit_terms',
];

function normHeader(s: string): string {
  return s.toLowerCase().replace(/[\s\-]/g, '_');
}

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const find = (aliases: string[]) =>
    headers.find(h => aliases.includes(normHeader(h))) ?? '';
  return {
    email:         find(EMAIL_ALIASES),
    full_name:     find(NAME_ALIASES),
    payment_terms: find(TERMS_ALIASES),
  };
}

export function applyColumnMapping(
  rawRows: Record<string, string>[],
  mapping: ColumnMapping,
): SupplierImportRow[] {
  return rawRows
    .map(row => ({
      email:     (mapping.email     ? String(row[mapping.email]     ?? '') : '').trim(),
      full_name: (mapping.full_name ? String(row[mapping.full_name] ?? '') : '').trim(),
      payment_terms: mapping.payment_terms
        ? String(row[mapping.payment_terms] ?? '').trim() || undefined
        : undefined,
    }))
    .filter(r => r.email || r.full_name);
}

// ─── Raw file parsers ─────────────────────────────────────────────────────────

async function parseRawCSV(file: File): Promise<RawParseResult> {
  return new Promise(resolve => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: result => {
        if (result.errors.length > 0 && result.data.length === 0) {
          resolve({ headers: [], rawRows: [], error: 'Failed to parse CSV: ' + result.errors[0].message });
          return;
        }
        const rawRows = result.data as Record<string, string>[];
        const headers: string[] =
          rawRows.length > 0
            ? Object.keys(rawRows[0])
            : (result.meta.fields ?? []);
        if (headers.length === 0) {
          resolve({ headers: [], rawRows: [], error: 'No columns found in the file.' });
          return;
        }
        resolve({ headers, rawRows });
      },
      error: err => {
        resolve({ headers: [], rawRows: [], error: 'Failed to read CSV file: ' + err.message });
      },
    });
  });
}

async function parseRawExcel(file: File): Promise<RawParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { headers: [], rawRows: [], error: 'Excel file contains no sheets.' };
    }
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
    const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
    if (headers.length === 0) {
      return { headers: [], rawRows: [], error: 'No columns found in the file.' };
    }
    return { headers, rawRows };
  } catch (err: unknown) {
    return {
      headers: [],
      rawRows: [],
      error: 'Failed to read Excel file: ' + (err instanceof Error ? err.message : 'Unknown error'),
    };
  }
}

export async function parseRawFile(file: File): Promise<RawParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return parseRawCSV(file);
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseRawExcel(file);
  return {
    headers: [],
    rawRows: [],
    error: 'Unsupported file type. Please upload a .csv, .xlsx, or .xls file.',
  };
}

// ─── Legacy result type (kept for API route compat) ───────────────────────────

export interface SupplierImportParseResult {
  rows: SupplierImportRow[];
  error?: string;
}
