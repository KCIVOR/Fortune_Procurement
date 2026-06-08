'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { getEnrichedAuditNames } from '@/lib/audit';
import type { AuditLog } from '@/types/audit';

interface AuditLogDetailProps {
  log: AuditLog | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AuditLogDetail({ log, isOpen, onClose }: AuditLogDetailProps) {
  const [enrichedNames, setEnrichedNames] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!log || log.action !== 'USER_ASSIGNMENT_UPDATED' || !log.payload) {
      setEnrichedNames({});
      return;
    }

    getEnrichedAuditNames(log.payload).then(names => {
      setEnrichedNames(names);
    }).catch(err => {
      console.error('Failed to enrich audit names:', err);
    });
  }, [log]);

  if (!log) return null;

  const timestamp = log.created_at ? format(new Date(log.created_at), 'PPP p') : 'N/A';
  const payload = log.payload as any;

  const formatAccountStatus = (value: unknown) => {
    if (value === false || value === 'false') return 'Inactive';
    return 'Active';
  };

  const showFriendlyUserPayload =
    log.action === 'USER_ASSIGNMENT_UPDATED' ||
    log.action === 'USER_DEACTIVATED' ||
    log.action === 'USER_REACTIVATED';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-pq-neutral-900">Audit Log Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Friendly Summary for USER_ASSIGNMENT_UPDATED */}
          {log.action === 'USER_ASSIGNMENT_UPDATED' && payload && (
            <div className="bg-pq-primary-50 border border-pq-neutral-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-pq-neutral-900">Assignment Changes</p>

              {payload.target_user_name && (
                <div className="text-sm text-pq-neutral-500">
                  <span className="font-medium">Target User:</span> {payload.target_user_name}
                  {payload.target_user_email && (
                    <span className="text-pq-neutral-500"> ({payload.target_user_email})</span>
                  )}
                </div>
              )}

              {payload.changed_fields && payload.changed_fields.length > 0 && (
                <div className="text-sm text-pq-neutral-500">
                  <span className="font-medium">Changed Fields:</span> {payload.changed_fields.join(', ')}
                </div>
              )}

              {payload.changed_fields?.includes('role_id') && (
                <div className="text-sm text-pq-neutral-500 ml-4 py-1 px-3 bg-white rounded border border-pq-neutral-200">
                  <span className="font-medium">Role:</span>
                  <span> {enrichedNames.old_role_name || payload.old_role_id || 'None'} → {enrichedNames.new_role_name || payload.new_role_id || 'None'}</span>
                </div>
              )}

              {payload.changed_fields?.includes('position_id') && (
                <div className="text-sm text-pq-neutral-500 ml-4 py-1 px-3 bg-white rounded border border-pq-neutral-200">
                  <span className="font-medium">Position:</span>
                  <span> {enrichedNames.old_position_title || payload.old_position_id || 'None'} → {enrichedNames.new_position_title || payload.new_position_id || 'None'}</span>
                </div>
              )}

              {payload.changed_fields?.includes('department_id') && (
                <div className="text-sm text-pq-neutral-500 ml-4 py-1 px-3 bg-white rounded border border-pq-neutral-200">
                  <span className="font-medium">Department:</span>
                  <span> {enrichedNames.old_department_name || payload.old_department_id || 'None'} → {enrichedNames.new_department_name || payload.new_department_id || 'None'}</span>
                </div>
              )}
            </div>
          )}

          {(log.action === 'USER_DEACTIVATED' || log.action === 'USER_REACTIVATED') && payload && (
            <div className="bg-pq-primary-50 border border-pq-neutral-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-pq-neutral-900">
                {log.action === 'USER_DEACTIVATED' ? 'User Deactivated' : 'User Reactivated'}
              </p>

              {payload.target_user_name && (
                <div className="text-sm text-pq-neutral-500">
                  <span className="font-medium">Target User:</span> {payload.target_user_name}
                  {payload.target_user_email && (
                    <span className="text-pq-neutral-500"> ({payload.target_user_email})</span>
                  )}
                </div>
              )}

              <div className="text-sm text-pq-neutral-500 ml-4 py-1 px-3 bg-white rounded border border-pq-neutral-200">
                <span className="font-medium">Status:</span>
                <span>
                  {' '}
                  {formatAccountStatus(payload.old_active)} → {formatAccountStatus(payload.new_active)}
                </span>
              </div>
            </div>
          )}

          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-pq-neutral-200">
            <div>
              <p className="text-xs font-medium text-pq-neutral-500 mb-1">Action</p>
              <p className="text-sm font-semibold text-pq-neutral-900">{log.action}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-pq-neutral-500 mb-1">Timestamp</p>
              <p className="text-sm text-pq-neutral-900">{timestamp}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-pq-neutral-500 mb-1">Document Type</p>
              <p className="text-sm text-pq-neutral-900">{log.document_type || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-pq-neutral-500 mb-1">Document ID</p>
              <p className="text-sm font-mono text-pq-neutral-900 break-all">{log.document_id || 'N/A'}</p>
            </div>
            {log.actor_id && (
              <div>
                <p className="text-xs font-medium text-pq-neutral-500 mb-1">Actor ID</p>
                <p className="text-sm font-mono text-pq-neutral-900 break-all">{log.actor_id}</p>
              </div>
            )}
            {log.ip_address && (
              <div>
                <p className="text-xs font-medium text-pq-neutral-500 mb-1">IP Address</p>
                <p className="text-sm font-mono text-pq-neutral-900">{log.ip_address}</p>
              </div>
            )}
          </div>

          {/* Payload */}
          {log.payload && (
            <div>
              <p className="text-xs font-medium text-pq-neutral-500 mb-2">Payload</p>
              {/* Approval Action Payloads */}
              {(log.action?.includes('APPROVAL_') || log.action?.includes('PR2_') || log.action?.includes('PO_')) && payload && (
                <div className="space-y-3 bg-pq-neutral-50 border border-pq-neutral-200 rounded p-4">
                  {payload.actor && (
                    <div>
                      <p className="text-xs font-medium text-pq-neutral-500 mb-1">Approved By</p>
                      <p className="text-sm text-pq-neutral-900">{payload.actor}</p>
                    </div>
                  )}
                  {payload.action && (
                    <div>
                      <p className="text-xs font-medium text-pq-neutral-500 mb-1">Action</p>
                      <p className="text-sm text-pq-neutral-900 capitalize">{payload.action}</p>
                    </div>
                  )}
                  {payload.position && (
                    <div>
                      <p className="text-xs font-medium text-pq-neutral-500 mb-1">Position</p>
                      <p className="text-sm text-pq-neutral-900">{payload.position}</p>
                    </div>
                  )}
                  {payload.step_order !== undefined && (
                    <div>
                      <p className="text-xs font-medium text-pq-neutral-500 mb-1">Step</p>
                      <p className="text-sm text-pq-neutral-900">{payload.step_order}</p>
                    </div>
                  )}
                  {payload.remarks !== undefined && (
                    <div>
                      <p className="text-xs font-medium text-pq-neutral-500 mb-1">Remarks</p>
                      <p className="text-sm text-pq-neutral-900">{payload.remarks || '—'}</p>
                    </div>
                  )}
                  {payload.instance_id && (
                    <div className="pt-2 border-t border-pq-neutral-200">
                      <p className="text-xs font-medium text-pq-neutral-400 mb-1">Instance ID</p>
                      <p className="text-xs font-mono text-pq-neutral-500 break-all">{payload.instance_id}</p>
                    </div>
                  )}
                </div>
              )}
              {/* Fallback: Raw JSON for other payload types */}
              {!(log.action?.includes('APPROVAL_') || log.action?.includes('PR2_') || log.action?.includes('PO_') || showFriendlyUserPayload) && payload && (
                <pre className="bg-pq-neutral-50 border border-pq-neutral-200 rounded p-3 text-xs text-pq-neutral-900 overflow-x-auto max-h-64 overflow-y-auto">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Log ID */}
          <div className="pt-2 border-t border-pq-neutral-200">
            <p className="text-xs font-medium text-pq-neutral-400 mb-1">Log ID</p>
            <p className="text-xs font-mono text-pq-neutral-500 break-all">{log.id}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
