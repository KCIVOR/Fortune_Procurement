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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#0F1F3A]">Audit Log Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Friendly Summary for USER_ASSIGNMENT_UPDATED */}
          {log.action === 'USER_ASSIGNMENT_UPDATED' && payload && (
            <div className="bg-[#F0F4FF] border border-[#D8E2FF] rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-[#0F1F3A]">Assignment Changes</p>

              {payload.target_user_name && (
                <div className="text-sm text-[#40527A]">
                  <span className="font-medium">Target User:</span> {payload.target_user_name}
                  {payload.target_user_email && (
                    <span className="text-[#7A8BA8]"> ({payload.target_user_email})</span>
                  )}
                </div>
              )}

              {payload.changed_fields && payload.changed_fields.length > 0 && (
                <div className="text-sm text-[#40527A]">
                  <span className="font-medium">Changed Fields:</span> {payload.changed_fields.join(', ')}
                </div>
              )}

              {payload.changed_fields?.includes('role_id') && (
                <div className="text-sm text-[#40527A] ml-4 py-1 px-3 bg-white rounded border border-[#E5EAFF]">
                  <span className="font-medium">Role:</span>
                  <span> {enrichedNames.old_role_name || payload.old_role_id || 'None'} → {enrichedNames.new_role_name || payload.new_role_id || 'None'}</span>
                </div>
              )}

              {payload.changed_fields?.includes('position_id') && (
                <div className="text-sm text-[#40527A] ml-4 py-1 px-3 bg-white rounded border border-[#E5EAFF]">
                  <span className="font-medium">Position:</span>
                  <span> {enrichedNames.old_position_title || payload.old_position_id || 'None'} → {enrichedNames.new_position_title || payload.new_position_id || 'None'}</span>
                </div>
              )}

              {payload.changed_fields?.includes('department_id') && (
                <div className="text-sm text-[#40527A] ml-4 py-1 px-3 bg-white rounded border border-[#E5EAFF]">
                  <span className="font-medium">Department:</span>
                  <span> {enrichedNames.old_department_name || payload.old_department_id || 'None'} → {enrichedNames.new_department_name || payload.new_department_id || 'None'}</span>
                </div>
              )}
            </div>
          )}

          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#E5EAFF]">
            <div>
              <p className="text-xs font-medium text-[#40527A] mb-1">Action</p>
              <p className="text-sm font-semibold text-[#0F1F3A]">{log.action}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#40527A] mb-1">Timestamp</p>
              <p className="text-sm text-[#0F1F3A]">{timestamp}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#40527A] mb-1">Document Type</p>
              <p className="text-sm text-[#0F1F3A]">{log.document_type || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#40527A] mb-1">Document ID</p>
              <p className="text-sm font-mono text-[#0F1F3A] break-all">{log.document_id || 'N/A'}</p>
            </div>
            {log.actor_id && (
              <div>
                <p className="text-xs font-medium text-[#40527A] mb-1">Actor ID</p>
                <p className="text-sm font-mono text-[#0F1F3A] break-all">{log.actor_id}</p>
              </div>
            )}
            {log.ip_address && (
              <div>
                <p className="text-xs font-medium text-[#40527A] mb-1">IP Address</p>
                <p className="text-sm font-mono text-[#0F1F3A]">{log.ip_address}</p>
              </div>
            )}
          </div>

          {/* Payload */}
          {log.payload && (
            <div>
              <p className="text-xs font-medium text-[#40527A] mb-2">Payload</p>
              {/* Approval Action Payloads */}
              {(log.action?.includes('APPROVAL_') || log.action?.includes('PR2_') || log.action?.includes('PO_')) && payload && (
                <div className="space-y-3 bg-[#F7F9FC] border border-[#D8E2FF] rounded p-4">
                  {payload.actor && (
                    <div>
                      <p className="text-xs font-medium text-[#40527A] mb-1">Approved By</p>
                      <p className="text-sm text-[#0F1F3A]">{payload.actor}</p>
                    </div>
                  )}
                  {payload.action && (
                    <div>
                      <p className="text-xs font-medium text-[#40527A] mb-1">Action</p>
                      <p className="text-sm text-[#0F1F3A] capitalize">{payload.action}</p>
                    </div>
                  )}
                  {payload.position && (
                    <div>
                      <p className="text-xs font-medium text-[#40527A] mb-1">Position</p>
                      <p className="text-sm text-[#0F1F3A]">{payload.position}</p>
                    </div>
                  )}
                  {payload.step_order !== undefined && (
                    <div>
                      <p className="text-xs font-medium text-[#40527A] mb-1">Step</p>
                      <p className="text-sm text-[#0F1F3A]">{payload.step_order}</p>
                    </div>
                  )}
                  {payload.remarks !== undefined && (
                    <div>
                      <p className="text-xs font-medium text-[#40527A] mb-1">Remarks</p>
                      <p className="text-sm text-[#0F1F3A]">{payload.remarks || '—'}</p>
                    </div>
                  )}
                  {payload.instance_id && (
                    <div className="pt-2 border-t border-[#E5EAFF]">
                      <p className="text-xs font-medium text-[#BFC7D5] mb-1">Instance ID</p>
                      <p className="text-xs font-mono text-[#40527A] break-all">{payload.instance_id}</p>
                    </div>
                  )}
                </div>
              )}
              {/* Fallback: Raw JSON for other payload types */}
              {!((log.action?.includes('APPROVAL_') || log.action?.includes('PR2_') || log.action?.includes('PO_')) && payload) && (
                <pre className="bg-[#F7F9FC] border border-[#D8E2FF] rounded p-3 text-xs text-[#0F1F3A] overflow-x-auto max-h-64 overflow-y-auto">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Log ID */}
          <div className="pt-2 border-t border-[#E5EAFF]">
            <p className="text-xs font-medium text-[#BFC7D5] mb-1">Log ID</p>
            <p className="text-xs font-mono text-[#40527A] break-all">{log.id}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
