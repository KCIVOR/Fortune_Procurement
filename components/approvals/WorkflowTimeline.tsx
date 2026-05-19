'use client';

import ActionPill from '@/components/shared/ActionPill';
import type { WorkflowStep, ApprovalActionRecord } from '@/types/approvals';
import { format } from 'date-fns';
import {
  CircleCheck as CheckCircle2,
  Circle as XCircle,
  RotateCcw,
} from 'lucide-react';

export interface WorkflowTimelineProps {
  steps: WorkflowStep[];
  actions: ApprovalActionRecord[];
  currentStep: number;
  instanceStatus: string;
}

/**
 * Read-only approval step list (used on /approvals/[id] and PR1 detail Signatories).
 */
export default function WorkflowTimeline({
  steps,
  actions,
  currentStep,
  instanceStatus,
}: WorkflowTimelineProps) {
  return (
    <ol className="relative space-y-0">
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
                {step.is_final && (
                  <span className="text-xs text-pq-neutral-400 italic">· Final</span>
                )}
              </div>

              {isComplete && (
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ActionPill action={action!.action} />
                    <span className="text-xs text-pq-neutral-500 font-medium">{action!.actor_name_snapshot}</span>
                    <span className="text-xs text-pq-neutral-400">
                      · {format(new Date(action!.acted_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  {action!.remarks && (
                    <p className="text-xs text-pq-neutral-500 italic ml-0.5">&quot;{action!.remarks}&quot;</p>
                  )}
                </div>
              )}

              {isCurrent && (
                <p className="mt-1 text-xs text-pq-primary-600 font-medium">Awaiting action</p>
              )}

              {isPending && (
                <p className="mt-1 text-xs text-pq-neutral-400">Not yet reached</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
