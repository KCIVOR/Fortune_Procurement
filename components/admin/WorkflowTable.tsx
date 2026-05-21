'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import { ChevronRight } from 'lucide-react';
import type { WorkflowConfig } from '@/types/workflow-admin';

interface WorkflowTableProps {
  workflows: WorkflowConfig[];
  isLoading: boolean;
  selectedWorkflowId?: string;
  onSelectWorkflow: (workflow: WorkflowConfig) => void;
}

export default function WorkflowTable({
  workflows,
  isLoading,
  selectedWorkflowId,
  onSelectWorkflow,
}: WorkflowTableProps) {
  if (isLoading) {
    return <TableSkeleton rows={4} cols={5} />;
  }

  if (workflows.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-pq-neutral-200 p-8 text-center">
        <EmptyState title="No workflows found" className="py-0 px-0" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-pq-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-pq-neutral-200 bg-pq-neutral-50">
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Code</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Name</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500 text-center">Steps</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500 text-center">Active Instances</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500 text-center">Status</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((workflow) => (
              <TableRow
                key={workflow.id}
                onClick={() => onSelectWorkflow(workflow)}
                className={`border-b border-pq-neutral-200 hover:bg-pq-primary-50 transition cursor-pointer ${
                  selectedWorkflowId === workflow.id ? 'bg-pq-primary-50' : ''
                }`}
              >
                <TableCell className="text-xs text-pq-neutral-900 font-medium">
                  <span className="px-2 py-1 bg-pq-primary-50 text-pq-primary-700 rounded text-xs inline-block font-mono">
                    {workflow.code}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-900">
                  {workflow.name}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500 text-center">
                  <span className="px-2 py-1 bg-pq-neutral-100 text-pq-neutral-700 rounded text-xs inline-block font-medium">
                    {workflow.step_count || 0}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500 text-center">
                  {workflow.instance_count !== undefined && workflow.instance_count > 0 ? (
                    <span className="px-2 py-1 bg-pq-warning-100 text-pq-warning-700 rounded text-xs inline-block font-medium">
                      {workflow.instance_count}
                    </span>
                  ) : (
                    <span className="text-pq-neutral-400">0</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500 text-center">
                  {workflow.active ? (
                    <span className="px-2 py-1 bg-pq-success-100 text-pq-success-600 rounded text-xs inline-block font-medium">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-pq-neutral-100 text-pq-neutral-500 rounded text-xs inline-block font-medium">
                      Inactive
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-400">
                  <ChevronRight className="w-4 h-4" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
