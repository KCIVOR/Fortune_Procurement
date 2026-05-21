# Workflow Admin System Design

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  /admin/workflows (NEW)                                      │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │  │
│  │  │ WorkflowTable  │  │ StepEditor     │  │ StepForm       │ │  │
│  │  │ (List view)    │  │ (Edit view)    │  │ (Dialog)       │ │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Existing Approval Pages (UNCHANGED)                         │  │
│  │  /approvals/[id]  /approvals/pr2/[id]  /approvals/po/[id]   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Uses
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BUSINESS LOGIC LAYER                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  lib/workflow-admin.ts (NEW)                                 │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  • listWorkflows()                                     │  │  │
│  │  │  • getWorkflowWithSteps()                              │  │  │
│  │  │  • validateWorkflowSteps()                             │  │  │
│  │  │  • createWorkflowStep()                                │  │  │
│  │  │  • updateWorkflowStep()                                │  │  │
│  │  │  • deleteWorkflowStep()                                │  │  │
│  │  │  • reorderWorkflowSteps()                              │  │  │
│  │  │  • logWorkflowAudit()                                  │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Existing Approval Logic (UNCHANGED - READ ONLY)            │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │  │
│  │  │ lib/approvals  │  │ lib/pr2-       │  │ lib/po-        │ │  │
│  │  │ .ts            │  │ approvals.ts   │  │ approvals.ts   │ │  │
│  │  │                │  │                │  │                │ │  │
│  │  │ • canActOnStep │  │ • PR2 auto-    │  │ • PO delivery  │ │  │
│  │  │ • submitAction │  │   approval     │  │   creation     │ │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Reads/Writes
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Supabase PostgreSQL Database                                │  │
│  │                                                               │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  approval_workflows                                    │  │  │
│  │  │  ├── id (PK)                                           │  │  │
│  │  │  ├── code (UNIQUE)                                     │  │  │
│  │  │  ├── name                                              │  │  │
│  │  │  ├── form_template_id (FK)                            │  │  │
│  │  │  └── active                                            │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                          │                                    │  │
│  │                          │ 1:N                                │  │
│  │                          ▼                                    │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  approval_steps                                        │  │  │
│  │  │  ├── id (PK)                                           │  │  │
│  │  │  ├── workflow_id (FK) ◄─── ADMIN MODIFIES             │  │  │
│  │  │  ├── step_order ◄────────── ADMIN MODIFIES             │  │  │
│  │  │  ├── role_required ◄──────── ADMIN MODIFIES            │  │  │
│  │  │  ├── position_required ◄─── ADMIN MODIFIES             │  │  │
│  │  │  ├── action_label ◄───────── ADMIN MODIFIES            │  │  │
│  │  │  └── is_final ◄──────────── ADMIN MODIFIES             │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                          │                                    │  │
│  │                          │ Referenced by                      │  │
│  │                          ▼                                    │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  approval_instances (UNCHANGED)                        │  │  │
│  │  │  ├── id (PK)                                           │  │  │
│  │  │  ├── workflow_id (FK)                                  │  │  │
│  │  │  ├── document_type                                     │  │  │
│  │  │  ├── document_id                                       │  │  │
│  │  │  ├── current_step ◄─── Reads from approval_steps      │  │  │
│  │  │  └── status                                            │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                          │                                    │  │
│  │                          │ 1:N                                │  │
│  │                          ▼                                    │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  approval_actions (UNCHANGED)                          │  │  │
│  │  │  ├── id (PK)                                           │  │  │
│  │  │  ├── instance_id (FK)                                  │  │  │
│  │  │  ├── step_order ◄─── References approval_steps        │  │  │
│  │  │  ├── action                                            │  │  │
│  │  │  ├── actor_id                                          │  │  │
│  │  │  └── acted_at                                          │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                               │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  audit_logs (NEW ENTRIES)                              │  │  │
│  │  │  ├── action: WORKFLOW_STEP_CREATED                     │  │  │
│  │  │  ├── action: WORKFLOW_STEP_UPDATED                     │  │  │
│  │  │  ├── action: WORKFLOW_STEP_DELETED                     │  │  │
│  │  │  └── action: WORKFLOW_STEPS_REORDERED                  │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### Flow 1: Admin Views Workflows
```
┌──────────┐     GET /admin/workflows     ┌──────────────────┐
│  Admin   │ ──────────────────────────► │  workflows/      │
│  User    │                              │  page.tsx        │
└──────────┘                              └──────────────────┘
                                                    │
                                                    │ calls
                                                    ▼
                                          ┌──────────────────┐
                                          │  workflow-admin  │
                                          │  .listWorkflows()│
                                          └──────────────────┘
                                                    │
                                                    │ SELECT
                                                    ▼
                                          ┌──────────────────┐
                                          │  approval_       │
                                          │  workflows       │
                                          │  + step counts   │
                                          └──────────────────┘
                                                    │
                                                    │ returns
                                                    ▼
┌──────────┐                              ┌──────────────────┐
│  Admin   │ ◄──────────────────────────  │  WorkflowTable   │
│  sees    │     Renders table            │  component       │
│  list    │                              └──────────────────┘
└──────────┘
```

### Flow 2: Admin Adds New Step
```
┌──────────┐     Clicks "Add Step"        ┌──────────────────┐
│  Admin   │ ──────────────────────────► │  StepForm        │
│  User    │                              │  Dialog opens    │
└──────────┘                              └──────────────────┘
                                                    │
                                                    │ Fills form
                                                    │ Clicks Save
                                                    ▼
                                          ┌──────────────────┐
                                          │  Client-side     │
                                          │  validation      │
                                          └──────────────────┘
                                                    │
                                                    │ Valid?
                                                    ▼
                                          ┌──────────────────┐
                                          │  workflow-admin  │
                                          │  .createStep()   │
                                          └──────────────────┘
                                                    │
                                                    │ 1. Validate position exists
                                                    │ 2. Check duplicate order
                                                    │ 3. Unmark other final steps
                                                    ▼
                                          ┌──────────────────┐
                                          │  INSERT INTO     │
                                          │  approval_steps  │
                                          └──────────────────┘
                                                    │
                                                    │ Success
                                                    ▼
                                          ┌──────────────────┐
                                          │  INSERT INTO     │
                                          │  audit_logs      │
                                          │  (STEP_CREATED)  │
                                          └──────────────────┘
                                                    │
                                                    │ returns
                                                    ▼
┌──────────┐                              ┌──────────────────┐
│  Admin   │ ◄──────────────────────────  │  Success message │
│  sees    │     Dialog closes            │  + refresh list  │
│  new step│                              └──────────────────┘
└──────────┘
```

### Flow 3: Existing Approval Flow (UNCHANGED)
```
┌──────────┐     Submits PR1              ┌──────────────────┐
│  User    │ ──────────────────────────► │  PR1 Form        │
└──────────┘                              └──────────────────┘
                                                    │
                                                    │ calls
                                                    ▼
                                          ┌──────────────────┐
                                          │  lib/approvals   │
                                          │  .submitForApproval()│
                                          └──────────────────┘
                                                    │
                                                    │ 1. Fetch workflow by code
                                                    │ 2. Create instance
                                                    ▼
                                          ┌──────────────────┐
                                          │  INSERT INTO     │
                                          │  approval_       │
                                          │  instances       │
                                          └──────────────────┘
                                                    │
                                                    │ instance created
                                                    ▼
┌──────────┐                              ┌──────────────────┐
│ Approver │ ◄──────────────────────────  │  Notification    │
│ notified │     Email/in-app             │  sent            │
└──────────┘                              └──────────────────┘
                                                    │
                                                    │ Views approval
                                                    ▼
                                          ┌──────────────────┐
                                          │  /approvals/[id] │
                                          │  page            │
                                          └──────────────────┘
                                                    │
                                                    │ Fetches steps
                                                    ▼
                                          ┌──────────────────┐
                                          │  SELECT FROM     │
                                          │  approval_steps  │
                                          │  WHERE workflow_id│
                                          └──────────────────┘
                                                    │
                                                    │ Renders dynamically
                                                    ▼
                                          ┌──────────────────┐
                                          │  WorkflowTimeline│
                                          │  component       │
                                          │  (reads from DB) │
                                          └──────────────────┘
                                                    │
                                                    │ Shows steps
                                                    ▼
┌──────────┐                              ┌──────────────────┐
│ Approver │ ◄──────────────────────────  │  Step 1: Supervisor│
│ sees     │     Including any new        │  Step 2: Dept Head │
│ timeline │     steps added by admin     │  Step 3: Director  │
└──────────┘                              └──────────────────┘
```

---

## 🔐 Security & Permissions

```
┌─────────────────────────────────────────────────────────────┐
│                    ROLE-BASED ACCESS CONTROL                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Admin Role (role = 'admin')                                │
│  ├── ✅ View all workflows                                  │
│  ├── ✅ View all steps                                      │
│  ├── ✅ Create new steps                                    │
│  ├── ✅ Edit existing steps                                 │
│  ├── ✅ Delete steps (with validation)                      │
│  ├── ✅ Reorder steps                                       │
│  └── ✅ View audit logs                                     │
│                                                             │
│  Non-Admin Roles (approver, procurement, etc.)              │
│  ├── ❌ Cannot access /admin/workflows                      │
│  ├── ✅ Can view approval timelines (read-only)             │
│  ├── ✅ Can submit approval actions                         │
│  └── ✅ Permissions checked against approval_steps          │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    DATABASE RLS POLICIES                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  approval_workflows                                         │
│  ├── SELECT: All authenticated users                        │
│  ├── INSERT: Admin only                                     │
│  ├── UPDATE: Admin only                                     │
│  └── DELETE: Admin only                                     │
│                                                             │
│  approval_steps                                             │
│  ├── SELECT: All authenticated users                        │
│  ├── INSERT: Admin only                                     │
│  ├── UPDATE: Admin only                                     │
│  └── DELETE: Admin only                                     │
│                                                             │
│  approval_instances (UNCHANGED)                             │
│  ├── SELECT: Based on document ownership                    │
│  ├── INSERT: Document owners + approvers                    │
│  └── UPDATE: System only (via lib functions)                │
│                                                             │
│  approval_actions (UNCHANGED)                               │
│  ├── SELECT: Based on instance access                       │
│  ├── INSERT: Authorized approvers only                      │
│  └── UPDATE: Immutable (no updates allowed)                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Component Interaction Map

```
┌─────────────────────────────────────────────────────────────┐
│                    /admin/workflows/page.tsx                │
│                                                             │
│  State Management:                                          │
│  ├── workflows: WorkflowConfig[]                            │
│  ├── selectedWorkflow: WorkflowConfig | null                │
│  ├── steps: WorkflowStepConfig[]                            │
│  ├── roles: {id, name}[]                                    │
│  ├── positions: {id, title, role}[]                         │
│  └── dialogs: {stepForm, deleteConfirm, reorderConfirm}     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  WorkflowTable                                        │  │
│  │  Props: workflows, isLoading, onSelectWorkflow        │  │
│  │  ├── Renders workflow list                            │  │
│  │  ├── Shows step counts                                │  │
│  │  └── Emits: onSelectWorkflow(workflow)                │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          │ User clicks workflow            │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  WorkflowStepEditor                                   │  │
│  │  Props: workflowId, steps, roles, positions,          │  │
│  │         onStepsChange                                 │  │
│  │  ├── Renders step table                               │  │
│  │  ├── Drag-and-drop reordering                         │  │
│  │  ├── Inline edit buttons                              │  │
│  │  ├── Delete buttons                                   │  │
│  │  ├── Add step button                                  │  │
│  │  └── Emits: onAddStep, onEditStep, onDeleteStep,      │  │
│  │              onReorderSteps                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          │ User clicks Add/Edit            │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  WorkflowStepForm (Dialog)                            │  │
│  │  Props: mode, initialData, roles, positions,          │  │
│  │         existingStepOrders, onSubmit, onCancel        │  │
│  │  ├── Step order input                                 │  │
│  │  ├── Role dropdown                                    │  │
│  │  ├── Position dropdown (filtered by role)             │  │
│  │  ├── Action label input                               │  │
│  │  ├── Is final checkbox                                │  │
│  │  ├── Client-side validation                           │  │
│  │  └── Emits: onSubmit(stepData), onCancel()            │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          │ User clicks Save                │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Page Handler: handleCreateStep / handleUpdateStep    │  │
│  │  ├── Calls workflow-admin.createWorkflowStep()        │  │
│  │  ├── Shows success/error message                      │  │
│  │  ├── Closes dialog                                    │  │
│  │  └── Refreshes step list                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 State Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPONENT STATE FLOW                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Initial Load:                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ useEffect(() => {                                   │   │
│  │   loadWorkflows();        // Fetch all workflows    │   │
│  │   loadRolesAndPositions(); // Fetch dropdowns       │   │
│  │ }, []);                                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ State Updated:                                      │   │
│  │ ├── workflows: [PR1_APPROVAL, PR2_PHASE1, ...]     │   │
│  │ ├── roles: [{id, name}, ...]                       │   │
│  │ └── positions: [{id, title, role}, ...]            │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ WorkflowTable renders with workflows                │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          │ User selects workflow           │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ useEffect(() => {                                   │   │
│  │   if (selectedWorkflow) {                           │   │
│  │     loadWorkflowSteps(selectedWorkflow.id);         │   │
│  │   }                                                 │   │
│  │ }, [selectedWorkflow]);                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ State Updated:                                      │   │
│  │ └── steps: [{step_order: 1, ...}, {step_order: 2}] │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ WorkflowStepEditor renders with steps               │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          │ User performs CRUD              │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ async function handleCreateStep(data) {             │   │
│  │   const result = await createWorkflowStep(...);     │   │
│  │   if (result.success) {                             │   │
│  │     await loadWorkflowSteps(selectedWorkflow.id);   │   │
│  │     setIsStepFormOpen(false);                       │   │
│  │   } else {                                          │   │
│  │     setError(result.error);                         │   │
│  │   }                                                 │   │
│  │ }                                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ State Updated:                                      │   │
│  │ └── steps: [...previous, newStep]                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ WorkflowStepEditor re-renders with new step         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

**END OF SYSTEM DESIGN**
