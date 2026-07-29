import type { PR2Request } from '@/types/pr2';

type PR2RequestTypeSource = Pick<PR2Request, 'request_type' | 'pr1_id'>;

/**
 * Prefer pr2.request_type (Phase 1 column) over a PR1 join. Falls back to
 * pr1?.request_type only for rows generated before the column existed, then
 * to 'goods'.
 */
export function resolvePR2RequestType(
  pr2: PR2RequestTypeSource,
  pr1?: { request_type: 'goods' | 'services' } | null
): 'goods' | 'services' | 'raw_material' {
  return pr2.request_type ?? pr1?.request_type ?? 'goods';
}

export function isRawMaterialPR2(pr2: PR2RequestTypeSource): boolean {
  return resolvePR2RequestType(pr2) === 'raw_material';
}

/**
 * True for a PR2 that originates directly (no pr1_id) — Raw Material or
 * Services created by Planning (Final_Workflow.md §5.1 step 1b, Services
 * Workflow Alignment Phase 4). Used everywhere the RFQ/canvassing layer needs
 * to branch on "no PR1 to key off of" rather than a specific request type.
 */
export function isPr2NativeDirectRequest(pr2: PR2RequestTypeSource): boolean {
  const type = resolvePR2RequestType(pr2);
  return !pr2.pr1_id && (type === 'raw_material' || type === 'services');
}
