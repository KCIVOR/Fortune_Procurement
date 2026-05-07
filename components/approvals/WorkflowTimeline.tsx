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
                      ? 'bg-emerald-600 border-emerald-600'
                      : action!.action === 'rejected'
                        ? 'bg-red-600 border-red-600'
                        : 'bg-orange-500 border-orange-500'
                    : isCurrent
                      ? 'bg-[#F7F9FC] border-[#1E4BFF]'
                      : 'bg-[#F7F9FC] border-[#D8E2FF]'
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
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1E4BFF] animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-[#BFC7D5]" />
                )}
              </div>
              {idx < steps.length - 1 && (
                <div className="w-0.5 flex-1 my-1 min-h-[24px] bg-[#D8E2FF]" />
              )}
            </div>

            <div className="pb-5 flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[#0F1F3A]">
                  Step {step.step_order}: {step.position_required}
                </span>
                <span className="text-xs text-[#BFC7D5]">{step.action_label}</span>
                {step.is_final && (
                  <span className="text-xs text-[#BFC7D5] italic">· Final</span>
                )}
              </div>

              {isComplete && (
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ActionPill action={action!.action} />
                    <span className="text-xs text-[#40527A] font-medium">{action!.actor_name_snapshot}</span>
                    <span className="text-xs text-[#BFC7D5]">
                      · {format(new Date(action!.acted_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  {action!.remarks && (
                    <p className="text-xs text-[#40527A] italic ml-0.5">&quot;{action!.remarks}&quot;</p>
                  )}
                </div>
              )}

              {isCurrent && (
                <p className="mt-1 text-xs text-[#1E4BFF] font-medium">Awaiting action</p>
              )}

              {isPending && (
                <p className="mt-1 text-xs text-[#BFC7D5]">Not yet reached</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
