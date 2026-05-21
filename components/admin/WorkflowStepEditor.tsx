'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import { Plus, Pencil, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import type { WorkflowStepConfig, PositionOption, RoleOption } from '@/types/workflow-admin';
import { getWorkflowWarnings } from '@/lib/workflow-admin';

interface WorkflowStepEditorProps {
  workflowId: string;
  workflowCode: string;
  steps: WorkflowStepConfig[];
  roles: RoleOption[];
  positions: PositionOption[];
  isLoading: boolean;
  onAddStep: () => void;
  onEditStep: (step: WorkflowStepConfig) => void;
  onDeleteStep: (step: WorkflowStepConfig) => void;
  activeInstanceCount?: number;
}

export default function WorkflowStepEditor({
  workflowId,
  workflowCode,
  steps,
  roles,
  positions,
  isLoading,
  onAddStep,
  onEditStep,
  onDeleteStep,
  activeInstanceCount = 0,
}: WorkflowStepEditorProps) {
  if (isLoading) {
    return <TableSkeleton rows={3} cols={6} />;
  }

  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);

  return (
    <div className="space-y-4">
      {/* Warning banner for active instances */}
      {activeInstanceCount > 0 && (
        <div className="bg-pq-warning-100 border border-pq-warning-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-pq-warning-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-pq-warning-900">Active Approval Instances</p>
            <p className="text-xs text-pq-warning-700 mt-1">
              This workflow has {activeInstanceCount} active approval instance(s). Changes to steps may affect ongoing approvals.
              Consider waiting for instances to complete before making major changes.
            </p>
          </div>
        </div>
      )}

      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-pq-neutral-900">Approval Steps</h3>
          <p className="text-xs text-pq-neutral-500 mt-1">
            Configure the approval pipeline for this workflow
          </p>
        </div>
        <Button onClick={onAddStep} size="sm" className="text-xs">
          <Plus className="w-4 h-4 mr-2" />
          Add Step
        </Button>
      </div>

      {/* Steps table */}
      {sortedSteps.length === 0 ? (
        <div className="bg-white rounded-lg border border-pq-neutral-200 p-8 text-center">
          <EmptyState
            title="No steps configured"
            description="Add approval steps to define the workflow"
            className="py-0 px-0"
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-pq-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                  <TableHead className="text-xs font-semibold text-pq-neutral-500 w-12"></TableHead>
                  <TableHead className="text-xs font-semibold text-pq-neutral-500 text-center w-20">Order</TableHead>
                  <TableHead className="text-xs font-semibold text-pq-neutral-500">Role</TableHead>
                  <TableHead className="text-xs font-semibold text-pq-neutral-500">Position</TableHead>
                  <TableHead className="text-xs font-semibold text-pq-neutral-500">Action Label</TableHead>
                  <TableHead className="text-xs font-semibold text-pq-neutral-500 text-center w-24">Final</TableHead>
                  <TableHead className="text-xs font-semibold text-pq-neutral-500 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSteps.map((step) => {
                  const warnings = getWorkflowWarnings(workflowCode, step.step_order);
                  const hasWarning = warnings.length > 0;

                  return (
                    <TableRow
                      key={step.id}
                      className={`border-b border-pq-neutral-200 hover:bg-pq-neutral-50 transition ${
                        hasWarning ? 'bg-pq-warning-50' : ''
                      }`}
                    >
                      <TableCell className="text-xs text-pq-neutral-400">
                        <GripVertical className="w-4 h-4" />
                      </TableCell>
                      <TableCell className="text-xs text-pq-neutral-900 font-medium text-center">
                        <span className="px-2 py-1 bg-pq-primary-100 text-pq-primary-700 rounded text-xs inline-block font-mono">
                          {step.step_order}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-pq-neutral-900">
                        <span className="px-2 py-1 bg-pq-success-100 text-pq-success-600 rounded text-xs inline-block">
                          {step.role_required}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-pq-neutral-900">
                        {step.position_required || '—'}
                        {hasWarning && (
                          <div className="flex items-start gap-1 mt-1">
                            <AlertCircle className="w-3 h-3 text-pq-warning-600 flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-pq-warning-700">{warnings[0]}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-pq-neutral-900">
                        {step.action_label}
                      </TableCell>
                      <TableCell className="text-xs text-pq-neutral-500 text-center">
                        {step.is_final ? (
                          <span className="px-2 py-1 bg-pq-success-100 text-pq-success-600 rounded text-xs inline-block font-medium">
                            Yes
                          </span>
                        ) : (
                          <span className="text-pq-neutral-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-pq-neutral-500 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditStep(step)}
                            className="text-xs text-pq-primary-600 hover:text-pq-primary-600 hover:bg-pq-primary-50"
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteStep(step)}
                            className="text-xs text-pq-danger-600 hover:text-pq-danger-600 hover:bg-pq-danger-50"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
