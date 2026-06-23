# Implementation Plan: Department Segregation (Feature 6)

This document details the phase-by-phase plan to implement **Department Segregation** across the Procurement System. The goal is to separate purchase requisitions, canvas slips, and purchase orders by department, ensuring that Supervisors and Department Heads (the `approver` role) only see, review, and act on requests matching their own department.

---

## Proposed Phases

### Phase 1: Database Schema & Row-Level Security (RLS)

#### 1a. Update `po_requests` Table
Add a `department_id` column referencing the `departments` table:
```sql
ALTER TABLE public.po_requests ADD COLUMN department_id uuid REFERENCES public.departments(id);
```

#### 1b. Create Performance Indexes
Add indexes to optimize department-based filtering across all request tables:
```sql
CREATE INDEX IF NOT EXISTS idx_pr1_requests_department_id ON public.pr1_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_pr2_requests_department_id ON public.pr2_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_po_requests_department_id ON public.po_requests(department_id);
```

#### 1c. Historical Data Backfill
Ensure existing POs are correctly linked by mapping `department_id` from the source `pr2_requests`:
```sql
UPDATE public.po_requests po
SET department_id = pr2.department_id
FROM public.pr2_requests pr2
WHERE po.pr2_id = pr2.id AND po.department_id IS NULL;
```

#### 1d. Tighten Row-Level Security (RLS) Policies
* **PR1 requests**: Modify the security definer function `public.can_read_pr1(p_pr1_id)` to restrict read access for the `approver` role (while exempting `Director` and `Finance Director` positions):
  ```sql
  CREATE OR REPLACE FUNCTION public.can_read_pr1(p_pr1_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public.pr1_requests pr
      WHERE pr.id = p_pr1_id
        AND (
          pr.requisitioner_id = auth.uid()
          OR public.is_role('admin')
          OR public.is_role('procurement')
          OR (
            public.is_role('warehouse')
            AND (
              pr.status = 'pending_warehouse'
              OR EXISTS (
                SELECT 1
                FROM public.warehouse_validations wv
                WHERE wv.pr1_id = pr.id
              )
            )
          )
          OR (
            public.is_role('approver')
            AND (
              EXISTS (
                SELECT 1 FROM public.profiles p
                LEFT JOIN public.positions pos ON pos.id = p.position_id
                WHERE p.id = auth.uid() AND pos.title IN ('Director', 'Finance Director')
              )
              OR pr.department_id = (SELECT department_id FROM public.profiles WHERE id = auth.uid())
            )
            AND EXISTS (
              SELECT 1
              FROM public.approval_instances ai
              WHERE ai.document_type = 'PR1'
                AND ai.document_id = pr.id
            )
          )
        )
    );
  $$;
  ```
* **PR2 requests**: Replace the SELECT/UPDATE RLS policies on `pr2_requests` for the `approver` role to enforce department matching (except for Directors):
  ```sql
  DROP POLICY IF EXISTS "Approvers can read all PR2 requests" ON public.pr2_requests;
  CREATE POLICY "Approvers can read own department PR2 requests"
    ON public.pr2_requests FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON r.id = p.role_id
        LEFT JOIN public.positions pos ON pos.id = p.position_id
        WHERE p.id = auth.uid()
          AND r.name = 'approver'
          AND (
            pos.title IN ('Director', 'Finance Director')
            OR p.department_id = pr2_requests.department_id
          )
      )
    );

  DROP POLICY IF EXISTS "Approvers can update PR2 request status" ON public.pr2_requests;
  CREATE POLICY "Approvers can update own department PR2 requests"
    ON public.pr2_requests FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON r.id = p.role_id
        LEFT JOIN public.positions pos ON pos.id = p.position_id
        WHERE p.id = auth.uid()
          AND r.name = 'approver'
          AND (
            pos.title IN ('Director', 'Finance Director')
            OR p.department_id = pr2_requests.department_id
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON r.id = p.role_id
        LEFT JOIN public.positions pos ON pos.id = p.position_id
        WHERE p.id = auth.uid()
          AND r.name = 'approver'
          AND (
            pos.title IN ('Director', 'Finance Director')
            OR p.department_id = pr2_requests.department_id
          )
      )
    );
  ```
* **PO requests**: Replace the SELECT/UPDATE RLS policies on `po_requests` for the `approver` role:
  ```sql
  DROP POLICY IF EXISTS "Approvers can read all POs" ON public.po_requests;
  CREATE POLICY "Approvers can read own department POs"
    ON public.po_requests FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON r.id = p.role_id
        LEFT JOIN public.positions pos ON pos.id = p.position_id
        WHERE p.id = auth.uid()
          AND r.name = 'approver'
          AND (
            pos.title IN ('Director', 'Finance Director')
            OR po_requests.department_id IS NULL
            OR p.department_id = po_requests.department_id
          )
      )
    );

  DROP POLICY IF EXISTS "Approvers can update PO status during approval" ON public.po_requests;
  CREATE POLICY "Approvers can update own department POs during approval"
    ON public.po_requests FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON r.id = p.role_id
        LEFT JOIN public.positions pos ON pos.id = p.position_id
        WHERE p.id = auth.uid()
          AND r.name = 'approver'
          AND (
            pos.title IN ('Director', 'Finance Director')
            OR po_requests.department_id IS NULL
            OR p.department_id = po_requests.department_id
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON r.id = p.role_id
        LEFT JOIN public.positions pos ON pos.id = p.position_id
        WHERE p.id = auth.uid()
          AND r.name = 'approver'
          AND (
            pos.title IN ('Director', 'Finance Director')
            OR po_requests.department_id IS NULL
            OR p.department_id = po_requests.department_id
          )
      )
    );
  ```

---

### Phase 2: Backend Logic & Type Upgrades

#### 2a. Update Type Definitions
* **[types/po.ts](file:///c:/Users/Rovick/Desktop/project/types/po.ts)**: Add `department_id?: string;` to `PORequest`.

#### 2b. Carry Over Department ID at PO Generation
* **[lib/po.ts](file:///c:/Users/Rovick/Desktop/project/lib/po.ts)**: Update `generatePOFromPR2()` to copy the `department_id` from the approved `PR2` to the new `PO` request row.

#### 2c. Enforce Department Matching in Permission Checks
* **[lib/approvals.ts](file:///c:/Users/Rovick/Desktop/project/lib/approvals.ts)** (`canActOnStep`):
  Add `documentDepartmentId` parameter. If user is an `approver` and `documentDepartmentId` does not match their `profile.department_id`, return `false`.
* **[lib/pr2-approvals.ts](file:///c:/Users/Rovick/Desktop/project/lib/pr2-approvals.ts)** (`canActOnPR2Step`):
  Add `documentDepartmentId`. Restrict `approver` access if departments don't match.
* **[lib/po-approvals.ts](file:///c:/Users/Rovick/Desktop/project/lib/po-approvals.ts)** (`canActOnPOStep`):
  Add `documentDepartmentId`. Restrict `approver` access if departments don't match.

#### 2d. Filter Queues by Department
* **[lib/approvals.ts](file:///c:/Users/Rovick/Desktop/project/lib/approvals.ts)** (`fetchApprovalQueue`), **[lib/pr2-approvals.ts](file:///c:/Users/Rovick/Desktop/project/lib/pr2-approvals.ts)** (`fetchPR2ApprovalQueue`), and **[lib/po-approvals.ts](file:///c:/Users/Rovick/Desktop/project/lib/po-approvals.ts)** (`fetchPOApprovalQueue`):
  Modify queue fetch queries to accept an optional `departmentId` parameter. If user is an `approver`, retrieve only requests matching their department.

---

### Phase 3: User Interface & Queue Integrations

#### 3a. Update Approvals Dashboard
* **[app/approvals/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/approvals/page.tsx)**: Update calculations and badges so that totals (Active, PR1, PR2, PO) only count requests from the approver's department.

#### 3b. Update Approval Sub-Queue pages
* **[app/approvals/pr1/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/approvals/pr1/page.tsx)**, **[app/approvals/pr2/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/approvals/pr2/page.tsx)**, and **[app/approvals/po/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/approvals/po/page.tsx)**:
  Ensure they query using the user's department filters and pass `department_id` to permission check functions before rendering action buttons.

#### 3c. Detail Pages Restraints
* **[app/approvals/\[id\]/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/approvals/[id]/page.tsx)**, **[app/approvals/pr2/\[id\]/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/approvals/pr2/[id]/page.tsx)**, and **[app/approvals/po/\[id\]/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/approvals/po/[id]/page.tsx)**:
  Ensure detail views and action panels are hidden or show an error if an unauthorized user attempts to view/approve a request from another department.

---

### Phase 4: Procurement / Admin Filter Bars & Reporting

#### 4a. Add Department Filters on Central Lists
* **[components/shared/FilterBar.tsx](file:///c:/Users/Rovick/Desktop/project/components/shared/FilterBar.tsx)**:
  Allow procurement/admin users to filter the master lists of RFQs, PR2s, and POs by department:
  * **[app/rfq/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/rfq/page.tsx)**
  * **[app/pr2/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/pr2/page.tsx)**
  * **[app/po/page.tsx](file:///c:/Users/Rovick/Desktop/project/app/po/page.tsx)**

---

## Surgical Mode: Risk Mitigation & Compatibility Guards

To prevent breaking existing active workflows:
1. **Gradual RLS rollout**: The database migrations will preserve existing RLS policies for `admin` and `procurement` roles. Only the `approver` policies are tightened.
2. **Executive Exemption**: The positions of **Director** and **Finance Director** are company-wide corporate approval roles. They are exempted from the department-segregation filters and policies, allowing them to continue approving high-value PR2s and POs across all departments.
3. **Nullable `department_id` on POs**: Adding `department_id` as nullable on `po_requests` ensures existing POs without a department reference do not fail to fetch or render. The migration backfill handles linking all current records.
4. **Optional parameters in check functions**: `documentDepartmentId` is added as optional in the permission check utilities (`canActOnStep`, etc.). If it is omitted (e.g. for legacy routes or items that do not specify a department), the check will fall back to normal position/role matching to prevent false negative lockouts.

---

## Open Questions

> [!IMPORTANT]
> **1. Centralized Roles Exception:**
> Do we agree that the centralized roles of **Procurement Staff / Managers**, **Buyers**, and **Warehouse Staff** should continue to see and process requests from all departments? (Our plan exempts them from department segregation).
>
> **2. Admin Management Views:**
> Should **Admin** users have the ability to view/filter all departments on their dashboards and queues? (Our plan exempts them).
