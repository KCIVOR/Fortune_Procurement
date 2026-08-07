# GRN/PO Print Fixes — Implementation Plan

## Goal
Fix two issues found during an audit of the GRN print form (triggered by a screenshot showing a broken table border and empty "Inspected By / Checked By / Noted By" boxes):

1. **Border break** — GRN and PO print pages' items tables misalign when the viewer can't see commercial pricing (`canViewPrices === false`), because the blank filler rows at the bottom of each table always render a fixed column count that doesn't match the header/real-row column count in that case.
2. **Permanently empty signature boxes** — GRN's "Inspected By," "Checked By," and "Noted By" boxes render as silently blank (`&nbsp;`) with zero data binding, unlike every other print form (PR1, PR2, PO, Planning PR2), where every signature slot is either data-bound or explicitly shows "Pending."

Full findings are in the audit conversation that preceded this plan.

---

## 🚨 READ THIS BEFORE TOUCHING ANY CODE (RULES FOR AI) 🚨
1. **STRICT SURGICAL EDITS:** Implement ONLY what is described in the phase you're on. Do not touch any file that isn't named in that phase.
2. **NO UNRELATED REFACTORING:** Do not clean up imports, reformat code, or rename variables outside the exact scope of the task. Do not refactor PR1/PR2's padded-array row pattern into GRN/PO, or vice versa — they're different, valid patterns; leave both as they are.
3. **DO NOT TOUCH PR1 OR PR2 PRINT TEMPLATES.** The audit confirmed they don't have the border-break bug (they pad the data array itself and reuse one row template, so their column count is already always consistent). Only GRN and PO need the Phase 1 fix.
4. **NO SCHEMA CHANGES** in Phase 1. It's a pure JSX/column-count fix, no new columns, no migrations.
5. **Phase 2 is gated on a decision — see "Open question" below.** Do not implement Phase 2 until it's confirmed. Phase 1 can be implemented independently and is not blocked by this.

---

## Phase 1: Fix the border-break bug (GRN + PO)
**Files:** `app/grn/[id]/print/page.tsx`, `app/po/[id]/print/page.tsx`

### GRN (`app/grn/[id]/print/page.tsx`)
1. Header (~lines 223-238) and real item rows (~lines 245-310) render **6 fixed columns + either 2 pricing columns (`canViewPrices`) or 1 ("Pricing")** — 8 or 7 total. This part is already correct; do not change it.
2. The blank filler row block (~lines 313-324) currently always renders 8 `<td>` cells:
   ```tsx
   {Array.from({ length: blankRows }).map((_, i) => (
     <tr key={`blank-${i}`}>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', height: 18 }}>&nbsp;</td>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
     </tr>
   ))}
   ```
   That's 6 fixed `<td>`s + 2 pricing `<td>`s, always — 8 no matter what.
3. Fix: make the last block conditional, mirroring the header/real-row pattern exactly:
   ```tsx
   {Array.from({ length: blankRows }).map((_, i) => (
     <tr key={`blank-${i}`}>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', height: 18 }}>&nbsp;</td>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
       <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
       {canViewPrices ? (
         <>
           <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
           <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
         </>
       ) : (
         <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
       )}
     </tr>
   ))}
   ```
4. Verify column count now matches in both cases: 6 + 2 = 8 (`canViewPrices` true) or 6 + 1 = 7 (`canViewPrices` false) — matching the header/real rows exactly.

### PO (`app/po/[id]/print/page.tsx`)
1. Same bug, same fix shape. Header/real rows: 5 fixed + 2-or-1 pricing = 7 or 6 columns.
2. The blank filler row block (~lines 394-404) currently always renders 7 `<td>`s (5 fixed + 2 pricing, hardcoded). Apply the identical conditional-split fix: keep the 5 fixed empty `<td>`s, then conditionally render 2 pricing `<td>`s (`canViewPrices`) or 1 (`!canViewPrices`).

## Phase 2: Signature box clarity for GRN (gated — see open question)
**Files:** `app/grn/[id]/print/page.tsx`

**Do not implement this phase until the open question below is answered.**

Confirmed in the audit: there is no data source anywhere in the system (`types/grn.ts`, `lib/grn.ts`, migrations) for "Inspected By" (Warehouse Staff), "Checked By" (Procurement Officer), or "Noted By" (Department Head) — GRN has no `approval_instances` workflow for these three roles, unlike PR1/PR2/PO. Only "Received By" and the separate "QA Approved By" section have real data.

Depending on the answer to the open question:

- **Option A — visual clarity only (smaller change):** change the three currently-blank `<div>{'&nbsp;'}</div>` placeholders (~lines 388, 393, 398) to explicitly say something like `Sign above` or leave the line but style it consistently so it doesn't read as "should have data but doesn't" — e.g., match the italic gray "Pending" style used everywhere else in this codebase for an intentionally-unfilled slot, but with wording that makes clear this one won't ever auto-fill (since there's no underlying workflow step to fill it from). No schema or data-fetching changes.
- **Option B — build real digital sign-off (larger change, separate plan):** would require new database columns on the GRN table (or a proper `approval_instances` workflow for GRN), new UI for warehouse staff/procurement officer/department head to actually record their sign-off, and RLS policies — this is a new feature, not a print-template fix, and should get its own audit + plan if chosen.

## Phase 3: Verification
1. `npx tsc --noEmit` — must be clean.
2. `npm run build` — must complete with no errors.
3. Manual column-count check: re-read both edited blank-row blocks and confirm they resolve to the same column count as their respective headers in both the `canViewPrices` true and false cases.
4. `git diff --stat` — confirm only `app/grn/[id]/print/page.tsx` and `app/po/[id]/print/page.tsx` changed (Phase 1), plus `app/grn/[id]/print/page.tsx` again if Phase 2 is approved and implemented — nothing else.
5. Dev-server boot check (no test credentials available for a full authenticated click-through with real pricing/non-pricing profiles — verify via `tsc`/build per standing practice, not a live browser walkthrough).

---

## Open question (blocks Phase 2 only)
Which signature-box option do you want — **A** (visual clarity/wording fix only, small) or **B** (build real digital sign-off for Inspected/Checked/Noted By, a separate larger feature)? Phase 1 (the border-break fix) does not depend on this answer and can be implemented on its own.
