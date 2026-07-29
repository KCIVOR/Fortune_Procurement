'use client';

import { format } from 'date-fns';
import {
  CheckCircle2,
  Circle as XCircle,
  RotateCcw,
  ClipboardList,
  Lock,
} from 'lucide-react';
import ActionPill from '@/components/shared/ActionPill';
import type { ApprovalActionRecord, WorkflowStep } from '@/types/approvals';

/** Non-approval step shown before signatory chain (e.g. Prepared By). */
export interface ApprovalPreparerStep {
  position: string;
  actionLabel?: string;
  /** Badge text under the step (defaults to "Prepared"). */
  statusLabel?: string;
  actorName: string;
  actedAt: string;
}

export interface ApprovalPhaseTimelineProps {
  phaseLabel: string;
  phaseSubLabel: string;
  steps: WorkflowStep[];
  actions: ApprovalActionRecord[];
  currentStep: number;
  instanceStatus: string;
  notStarted?: boolean;
  preparer?: ApprovalPreparerStep | null;
}

export default function ApprovalPhaseTimeline({
  phaseLabel,
  phaseSubLabel,
  steps,
  actions,
  currentStep,
  instanceStatus,
  notStarted,
  preparer,
}: ApprovalPhaseTimelineProps) {
  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-pq-neutral-200">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 text-pq-neutral-400" />
          <div>
            <h2 className="text-xs font-semibold text-pq-neutral-900 uppercase tracking-wide">{phaseLabel}</h2>
            <p className="text-xs text-pq-neutral-400 mt-0.5">{phaseSubLabel}</p>
          </div>
          {notStarted && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-pq-neutral-400 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-2.5 py-1">
              <Lock className="w-3 h-3" />
              Not started
            </span>
          )}
          {!notStarted && instanceStatus === 'approved' && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </span>
          )}
          {!notStarted && instanceStatus === 'active' && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-pq-neutral-900 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-pq-primary-600 animate-pulse" />
              In Progress
            </span>
          )}
        </div>
      </div>
      <div className="p-6">
        {notStarted ? (
          <p className="text-sm text-pq-neutral-400 italic">Approval timeline will appear once submitted.</p>
        ) : (
          <WorkflowTimeline
            preparer={preparer}
            steps={steps}
            actions={actions}
            currentStep={currentStep}
            instanceStatus={instanceStatus}
          />
        )}
      </div>
    </div>
  );
}

function WorkflowTimeline({
  preparer,
  steps,
  actions,
  currentStep,
  instanceStatus,
}: {
  preparer?: ApprovalPreparerStep | null;
  steps: WorkflowStep[];
  actions: ApprovalActionRecord[];
  currentStep: number;
  instanceStatus: string;
}) {
  return (
    <ol className="relative space-y-0">
      {preparer && (
        <PreparerTimelineRow preparer={preparer} hasStepsBelow={steps.length > 0} />
      )}
      {steps.map((step, idx) => {
        const action = actions.find(a => a.step_order === step.step_order);
        const isComplete = !!action;
        const isCurrent = !isComplete && step.step_order === currentStep && instanceStatus === 'active';
        const isPending = !isComplete && !isCurrent;

        return (
          <li key={step.step_order} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 ${
                  isComplete
                    ? action!.action === 'approved'
                      ? 'bg-pq-success-600 border-pq-success-600'
                      : action!.action === 'rejected'
                        ? 'bg-pq-danger-600 border-pq-danger-600'
                        : 'bg-orange-500 border-orange-500'
                    : isCurrent
                      ? 'bg-pq-neutral-50 border-pq-primary-600'
                      : 'bg-pq-neutral-50 border-pq-neutral-200'
                }`}
              >
                {isComplete ? (
                  action!.action === 'approved' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  ) : action!.action === 'rejected' ? (
                    <XCircle className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 text-white" />
                  )
                ) : isCurrent ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-pq-primary-600 animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-pq-neutral-400" />
                )}
              </div>
              {idx < steps.length - 1 && (
                <div className="w-0.5 flex-1 my-1 min-h-[24px] bg-pq-neutral-200" />
              )}
            </div>

            <div className="pb-5 flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold text-pq-neutral-900">
                  Step {step.step_order}: {step.position_required}
                </span>
                <span className="text-xs text-pq-neutral-400">{step.action_label}</span>
                {step.is_final && <span className="text-xs text-pq-neutral-400 italic">· Final</span>}
              </div>

              {isComplete && (
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <ActionPill action={action!.action} />
                    <span className="text-xs text-pq-neutral-500 font-medium">{action!.actor_name_snapshot}</span>
                    <span className="text-xs text-pq-neutral-400">
                      · {format(new Date(action!.acted_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  {action!.remarks && (
                    <p className="text-xs text-pq-neutral-500 italic ml-0.5">
                      &ldquo;{action!.remarks}&rdquo;
                    </p>
                  )}
                </div>
              )}
              {isCurrent && <p className="mt-1 text-xs text-pq-primary-600 font-medium">Awaiting action</p>}
              {isPending && <p className="mt-1 text-xs text-pq-neutral-400">Not yet reached</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PreparerTimelineRow({
  preparer,
  hasStepsBelow,
}: {
  preparer: ApprovalPreparerStep;
  hasStepsBelow: boolean;
}) {
  const actionLabel = preparer.actionLabel ?? 'Prepared By';
  const statusLabel = preparer.statusLabel ?? 'Prepared';

  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 bg-pq-success-600 border-pq-success-600">
          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
        </div>
        {hasStepsBelow && (
          <div className="w-0.5 flex-1 my-1 min-h-[24px] bg-pq-neutral-200" />
        )}
      </div>

      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold text-pq-neutral-900">{preparer.position}</span>
          <span className="text-xs text-pq-neutral-400">{actionLabel}</span>
        </div>
        <div className="mt-1.5 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded-full px-2 py-0.5">
              <CheckCircle2 className="w-3 h-3" />
              {statusLabel}
            </span>
            <span className="text-xs text-pq-neutral-500 font-medium">{preparer.actorName}</span>
            <span className="text-xs text-pq-neutral-400">
              · {format(new Date(preparer.actedAt), 'MMM d, yyyy h:mm a')}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
