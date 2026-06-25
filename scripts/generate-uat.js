/* eslint-disable */
'use strict';

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, HeadingLevel, LevelFormat, PageBreak,
} = require('docx');
const fs = require('fs');
const path = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────
const A4_W = 11906;
const A4_H = 16838;
const MARGIN = 1440; // 1 inch
const CONTENT_W = A4_W - MARGIN * 2; // 9026 DXA

const COLORS = {
  headerFill:    '2E75B6',
  tableHeader:   'D9D9D9',
  white:         'FFFFFF',
  accent:        'E8F0FB',
  text:          '000000',
  lightGray:     'F5F5F5',
};

// TC table column widths (must sum to CONTENT_W = 9026)
const COL_W = [800, 1300, 800, 1000, 1526, 1500, 700, 600, 800];
// TC ID | Test Case Name | Module | Pre-conditions | Test Steps | Expected Result | Actual Result | Status | Remarks

const HEADERS_TEXT = ['TC ID','Test Case Name','Module','Pre-conditions','Test Steps','Expected Result','Actual Result','Status','Remarks'];

// ─── Cell border helper ────────────────────────────────────────────────────────
const b1 = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const BORDERS = { top: b1, bottom: b1, left: b1, right: b1 };

// ─── Table header row ─────────────────────────────────────────────────────────
function makeHeaderRow() {
  return new TableRow({
    tableHeader: true,
    children: HEADERS_TEXT.map((h, i) =>
      new TableCell({
        borders: BORDERS,
        width: { size: COL_W[i], type: WidthType.DXA },
        shading: { fill: COLORS.tableHeader, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, size: 18, font: 'Arial' })],
        })],
      })
    ),
  });
}

// ─── Test case data row ───────────────────────────────────────────────────────
// cells: [tcId, name, module, preConditions, steps, expected, actual, status, remarks]
// steps can be a string with \n for line breaks (rendered as numbered lines)
function makeDataRow(cells, altRow = false) {
  const fill = altRow ? COLORS.lightGray : COLORS.white;
  return new TableRow({
    children: cells.map((text, i) => {
      const isTcId = i === 0;
      // Split steps by \n for multi-paragraph
      const parts = String(text || '').split('\n');
      const paras = parts.map((p, pi) =>
        new Paragraph({
          children: [new TextRun({
            text: p,
            bold: isTcId,
            size: 17,
            font: 'Arial',
          })],
          spacing: { after: pi < parts.length - 1 ? 60 : 0 },
        })
      );
      return new TableCell({
        borders: BORDERS,
        width: { size: COL_W[i], type: WidthType.DXA },
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: VerticalAlign.TOP,
        children: paras,
      });
    }),
  });
}

// ─── Build a module TC table ───────────────────────────────────────────────────
function makeTCTable(testCases) {
  const rows = [makeHeaderRow()];
  testCases.forEach((tc, idx) => {
    rows.push(makeDataRow(tc, idx % 2 === 1));
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: COL_W,
    rows,
  });
}

// ─── Section heading helpers ──────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, size: 32, font: 'Arial', color: '2E75B6' })],
    spacing: { before: 360, after: 200 },
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, size: 26, font: 'Arial', color: '2E75B6' })],
    spacing: { before: 280, after: 140 },
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, size: 22, font: 'Arial', color: '1F5C99' })],
    spacing: { before: 200, after: 100 },
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, font: 'Arial', ...opts })],
    spacing: { after: 120 },
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    children: [new TextRun({ text, size: 20, font: 'Arial' })],
    spacing: { after: 80 },
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function spacer() {
  return new Paragraph({ children: [], spacing: { after: 120 } });
}

// ─── Test case data ────────────────────────────────────────────────────────────
// Format: [TC_ID, Name, Module, Pre-conditions, Steps, Expected Result, '', '', '']

const TC = {

  AUTH: [
    ['TC-AUTH-001','Login with valid credentials','Authentication',
      'System is accessible; valid user account exists and is active',
      '1. Navigate to /login\n2. Enter valid email address\n3. Enter correct password\n4. Click "Sign In"',
      'User is authenticated and redirected to /dashboard. Role-appropriate dashboard is displayed.',
      '','',''],
    ['TC-AUTH-002','Login with incorrect password','Authentication',
      'Valid user account exists',
      '1. Navigate to /login\n2. Enter valid email\n3. Enter incorrect password\n4. Click "Sign In"',
      'System displays an authentication error. User remains on the login page. No session is created.',
      '','',''],
    ['TC-AUTH-003','Login with non-existent email','Authentication',
      'No preconditions required',
      '1. Navigate to /login\n2. Enter an email that does not exist in the system\n3. Enter any password\n4. Click "Sign In"',
      'System displays an authentication error. User is not logged in.',
      '','',''],
    ['TC-AUTH-004','Forgot password — request reset link','Authentication',
      'Valid user account exists with a registered email',
      '1. Navigate to /login\n2. Click "Forgot password"\n3. Enter registered email address\n4. Click "Send Reset Link"',
      'System sends a password reset email to the address. Confirmation message is displayed.',
      '','',''],
    ['TC-AUTH-005','Reset password with valid link','Authentication',
      'Password reset email has been received; link has not expired',
      '1. Open password reset link from email\n2. Enter new password (min 8 characters)\n3. Confirm new password\n4. Click "Reset Password"',
      'Password is updated. User is redirected to login. New password can be used to sign in successfully.',
      '','',''],
    ['TC-AUTH-006','Inactive user cannot log in','Authentication',
      'A user account exists and has been deactivated by admin',
      '1. Navigate to /login\n2. Enter the inactive user\'s email and password\n3. Click "Sign In"',
      'User is denied access. System redirects to /login. No session is created. User is automatically signed out if session existed.',
      '','',''],
    ['TC-AUTH-007','Unauthenticated access to protected route','Authentication',
      'No active session in browser',
      '1. Without logging in, navigate directly to /dashboard (or any protected route)\n2. Observe the redirect behavior',
      'System redirects user to /login with the original path preserved as a redirect parameter.',
      '','',''],
    ['TC-AUTH-008','Complete invite — set password and activate account','Authentication',
      'Admin has sent an invite email to the user; invite link is accessible',
      '1. Open the invite link from the email\n2. Enter a new password (min 8 characters)\n3. Confirm password\n4. Click "Complete Setup"',
      'Account is activated. User can log in with the new password and sees their assigned role\'s dashboard.',
      '','',''],
  ],

  PR1: [
    ['TC-PR1-001','Create draft PR1 with all required fields','PR1 – Purchase Requisition',
      'User is logged in as an employee; user has an assigned department',
      '1. Navigate to My Requests (/pr1)\n2. Click "New Request"\n3. Enter a valid PR1 number (e.g., PR1-2026-0001)\n4. Enter Purpose\n5. Select Date Required\n6. Select Request Type (Goods)\n7. Add at least one line item (item code, description, UOM, qty)\n8. Click "Save Draft"',
      'PR1 is saved with status "Draft". User is redirected to the PR1 detail page. PR1 number appears in the list.',
      '','',''],
    ['TC-PR1-002','Submit PR1 for approval','PR1 – Purchase Requisition',
      'A draft PR1 exists for the logged-in employee',
      '1. Open the draft PR1\n2. Review all items\n3. Click "Submit for Approval"\n4. Confirm submission',
      'PR1 status changes to "Pending Warehouse" or "Pending Approval" (depending on workflow). An approval workflow instance is created. Approvers are notified.',
      '','',''],
    ['TC-PR1-003','Submit PR1 with duplicate PR1 number','PR1 – Purchase Requisition',
      'A PR1 with number PR1-2026-0001 already exists in the system',
      '1. Create new PR1\n2. Enter PR1 number that already exists (PR1-2026-0001)\n3. Fill remaining required fields\n4. Click "Save Draft"',
      'System displays an error: "This PR1 number is already in use. Please choose a different number." PR1 is not saved.',
      '','',''],
    ['TC-PR1-004','Submit PR1 with no line items','PR1 – Purchase Requisition',
      'User is logged in as an employee',
      '1. Create a new PR1 with all header fields filled\n2. Do not add any line items\n3. Attempt to save or submit',
      'System prevents submission. Validation error is displayed indicating at least one item is required.',
      '','',''],
    ['TC-PR1-005','Edit and resubmit a revision-requested PR1','PR1 – Purchase Requisition',
      'A PR1 with status "Revision Requested" exists for the logged-in employee',
      '1. Open the PR1 with Revision Requested status\n2. Update the requested items or fields\n3. Click "Save Draft"\n4. Click "Resubmit"',
      'PR1 status returns to "Pending Warehouse" or "Pending Approval". Updated content is persisted. New approval instance is created.',
      '','',''],
    ['TC-PR1-006','Delete a draft PR1','PR1 – Purchase Requisition',
      'A PR1 with status "Draft" belongs to the logged-in employee',
      '1. Open the draft PR1 detail\n2. Click "Delete"\n3. Confirm deletion in the dialog',
      'PR1 and its line items are permanently deleted. PR1 no longer appears in the list. Audit log entry is created.',
      '','',''],
    ['TC-PR1-007','Upload file attachment to a PR1 line item','PR1 – Purchase Requisition',
      'A draft or revision-requested PR1 exists with at least one line item',
      '1. Open the PR1 in edit/view mode\n2. Locate a line item\n3. Click "Attach File"\n4. Select a valid file (PDF, image)\n5. Confirm upload',
      'File is uploaded to Supabase Storage. Attachment appears linked to the PR1 item. Signed URL is generated for display.',
      '','',''],
    ['TC-PR1-008','Update PR1 priority — procurement user','PR1 – Purchase Requisition',
      'A PR1 exists (any status); user is logged in as procurement or approver role',
      '1. Open any PR1 detail\n2. Locate the Priority field\n3. Change priority from Normal to High\n4. Save',
      'Priority is updated to "High". Audit log records the change with old and new priority values.',
      '','',''],
    ['TC-PR1-009','Employee attempts to update PR1 priority','PR1 – Purchase Requisition',
      'A PR1 exists; user is logged in as employee role',
      '1. Open a PR1 detail\n2. Attempt to change the Priority field',
      'Priority field is not editable for employee role. System returns authorization error if API is called directly.',
      '','',''],
    ['TC-PR1-010','View PR1 lifecycle tracking status','PR1 – Purchase Requisition',
      'A PR1 with downstream documents (PR2, PO, Delivery) exists',
      '1. Navigate to My Requests\n2. Open a PR1 that has progressed through the workflow',
      'PR1 list and detail show correct lifecycle label (e.g., "PO — Sent to Supplier", "Delivery In Progress", "Completed (GRN Closed)") derived from linked documents.',
      '','',''],
  ],

  WH: [
    ['TC-WH-001','Validate PR1 — full internal fulfillment (SOH sufficient)','Warehouse Validation',
      'A PR1 with status "Pending Warehouse" exists; user is logged in as warehouse role',
      '1. Navigate to Warehouse Queue (/warehouse)\n2. Open the PR1 in the queue\n3. For each line item, enter validated SOH >= quantity requested\n4. Click "Submit Validation"',
      'PR1 status changes to "Approved for Warehouse" (resolved internally). Each item is routed as "internal". Procurement quantity = 0. Employee is notified.',
      '','',''],
    ['TC-WH-002','Validate PR1 — full procurement route (SOH = 0)','Warehouse Validation',
      'A PR1 with status "Pending Warehouse" exists; warehouse user logged in',
      '1. Open PR1 from Warehouse Queue\n2. Enter validated SOH = 0 for all line items\n3. Click "Submit Validation"',
      'PR1 status advances to "Pending Approval" or "For Canvassing". Each item is routed as "procurement". Procurement quantity = full requested qty.',
      '','',''],
    ['TC-WH-003','Validate PR1 — partial fulfillment (mixed route)','Warehouse Validation',
      'A PR1 with multiple items exists with status "Pending Warehouse"',
      '1. Open PR1 from Warehouse Queue\n2. Enter SOH that is > 0 but < quantity requested for an item\n3. Submit validation',
      'Item is routed as "partial". Internal fulfilled qty = SOH. Procurement qty = requested - SOH. PR1 advances correctly.',
      '','',''],
    ['TC-WH-004','Reject PR1 — send back for revision','Warehouse Validation',
      'A PR1 exists in Warehouse Queue',
      '1. Open PR1 from Warehouse Queue\n2. Click "Reject / Request Revision"\n3. Enter rejection reason\n4. Confirm',
      'PR1 status changes to "Revision Requested". Employee is notified with the reason. PR1 disappears from Warehouse Queue.',
      '','',''],
    ['TC-WH-005','View Warehouse Queue with filters','Warehouse Validation',
      'Multiple PR1 records exist with various statuses; user is warehouse role',
      '1. Navigate to /warehouse\n2. Review the queue list\n3. Apply filters (e.g., by status or date)',
      'Queue displays only PR1 records pending warehouse validation. Filter correctly narrows results.',
      '','',''],
    ['TC-WH-006','View Warehouse History','Warehouse Validation',
      'Warehouse validations have been previously completed',
      '1. Navigate to Warehouse History (/warehouse/history)\n2. Review the completed validation records',
      'List shows historical warehouse validations with decision, validator name, position, and date.',
      '','',''],
  ],

  APR: [
    ['TC-APR-001','Approve PR1 at first workflow step','Approvals',
      'PR1 is in "Pending Approval" status; logged-in approver matches step 1 role and position',
      '1. Navigate to Approval Queue (/approvals)\n2. Open a PR1 pending approval\n3. Review PR1 details and items\n4. Click "Approve"\n5. Optionally add remarks\n6. Confirm',
      'Approval action is recorded. PR1 advances to next step or final approval. Approver at next step is notified if multi-step.',
      '','',''],
    ['TC-APR-002','Reject PR1 at any approval step','Approvals',
      'PR1 is pending approval; approver has authority for the current step',
      '1. Open a PR1 from the Approval Queue\n2. Click "Reject"\n3. Enter rejection reason (required)\n4. Confirm rejection',
      'PR1 status changes to "Rejected". Approval instance is updated. Requisitioner is notified. PR1 cannot be re-submitted.',
      '','',''],
    ['TC-APR-003','Request revision on a pending PR1','Approvals',
      'PR1 is pending approval; approver has authority for the current step',
      '1. Open a PR1 from the Approval Queue\n2. Click "Request Revision"\n3. Enter revision notes\n4. Confirm',
      'PR1 status changes to "Revision Requested". Approval instance is cancelled. Requisitioner is notified. PR1 can be edited and resubmitted.',
      '','',''],
    ['TC-APR-004','Approve PR2 through all workflow steps','Approvals',
      'PR2 exists in Pending Approval status; approvers for each step are logged in',
      '1. Each approver in sequence opens the PR2 from their queue\n2. Reviews PR2 items, supplier, pricing\n3. Clicks Approve\n4. Proceeds until final step',
      'PR2 status changes to "Approved" after final step approval. Procurement is notified. PR2 becomes eligible for PO generation.',
      '','',''],
    ['TC-APR-005','Approve PO through complete workflow','Approvals',
      'PO exists in "For Approval" status; all approvers in the 4-step chain are available',
      '1. Procurement Staff approves at step 1\n2. Procurement Manager approves at step 2\n3. Director approves at step 3\n4. Finance Director approves at step 4',
      'PO status changes to "Approved" after step 4. A delivery record is automatically created. Supplier is notified.',
      '','',''],
    ['TC-APR-006','Unauthorized user attempts to approve a document','Approvals',
      'A document is pending approval at step 2 requiring Director position; logged-in user is Staff',
      '1. Attempt to open the document from the Approval Queue\n2. Try to click Approve',
      'Approve action is not available or system returns access denied. Action is blocked.',
      '','',''],
    ['TC-APR-007','View approval history','Approvals',
      'Historical approvals exist in the system; user is approver or procurement role',
      '1. Navigate to Approval History (/approvals/history)\n2. Review past approval actions',
      'List shows completed approval instances with document reference, approver name, action (approved/rejected), and date.',
      '','',''],
  ],

  PR2: [
    ['TC-PR2-001','View PR2 created from canvassing-complete PR1','PR2 – Purchase Request 2',
      'A PR1 with status "Canvassing Complete" exists; an associated PR2 has been created',
      '1. Navigate to Purchase Requests (/pr2)\n2. Open a PR2 record',
      'PR2 detail shows linked PR1 number, RFQ number, department, purpose, and line items with supplier names, unit prices, and quantities to purchase.',
      '','',''],
    ['TC-PR2-002','Procurement selects supplier and sets price on PR2 items','PR2 – Purchase Request 2',
      'An RFQ has been closed; PR2 is in draft or awaiting supplier selection; user is procurement role',
      '1. Open the PR2\n2. For each line item, select the winning supplier from the quote matrix\n3. Confirm unit price and quantity to purchase\n4. Save changes',
      'PR2 items are updated with selected supplier name, unit price, and quantity. Total price is computed as unit_price * quantity_to_purchase.',
      '','',''],
    ['TC-PR2-003','Submit PR2 for approval','PR2 – Purchase Request 2',
      'PR2 has all items with supplier selection completed; user is procurement role',
      '1. Open the PR2 detail\n2. Click "Submit for Approval"\n3. Confirm',
      'PR2 status changes to "Pending Approval". Approval workflow is initiated. First-step approver is notified.',
      '','',''],
    ['TC-PR2-004','View quote justification on PR2 item','PR2 – Purchase Request 2',
      'A PR2 exists with items that have a quote justification entered',
      '1. Open the PR2 detail\n2. Locate a line item with quote justification',
      'Quote justification text is visible on the line item, explaining why the selected supplier was chosen.',
      '','',''],
    ['TC-PR2-005','Print PR2','PR2 – Purchase Request 2',
      'A PR2 exists with items; user has access to the PR2',
      '1. Open the PR2 detail\n2. Click the Print button\n3. View the print layout',
      'System renders a print-optimized view of the PR2 with all items, supplier info, pricing, and approval signatures.',
      '','',''],
  ],

  RFQ: [
    ['TC-RFQ-001','Create RFQ batch from approved PR1','Canvassing / RFQ',
      'A PR1 with status "For Canvassing" or "Approved" exists; user is procurement role',
      '1. Navigate to Canvassing / RFQ (/rfq)\n2. Click "Create RFQ"\n3. Link to the approved PR1\n4. Confirm creation',
      'RFQ batch is created with auto-generated RFQ number (format: RFQ-YEAR-####). RFQ status is "Open".',
      '','',''],
    ['TC-RFQ-002','Assign registered supplier to RFQ','Canvassing / RFQ',
      'An open RFQ batch exists; at least one registered supplier account exists',
      '1. Open the RFQ detail\n2. Click "Assign Suppliers"\n3. Search and select a registered supplier\n4. Save',
      'Supplier is assigned to the RFQ. Supplier appears in the RFQ supplier list. Supplier can now see the RFQ in their quotation portal.',
      '','',''],
    ['TC-RFQ-003','Assign external (non-registered) vendor to RFQ','Canvassing / RFQ',
      'An open RFQ batch exists',
      '1. Open the RFQ detail\n2. Click "Assign Suppliers"\n3. Select "External Vendor" option\n4. Enter vendor name\n5. Save',
      'External vendor is added to the RFQ supplier list with is_external = true. A PO can later be generated for this vendor.',
      '','',''],
    ['TC-RFQ-004','Supplier submits quote with price and lead time','Canvassing / RFQ',
      'A supplier is assigned to an open RFQ; user is logged in as that supplier',
      '1. Navigate to Quotations (/supplier/quotations)\n2. Open the RFQ\n3. For each line item, enter unit price and lead time\n4. Optionally enter remarks\n5. Click "Submit Quote"',
      'Quote is saved per line item. Quote appears in the procurement quote matrix view.',
      '','',''],
    ['TC-RFQ-005','Supplier marks a line as "No Quote"','Canvassing / RFQ',
      'A supplier is assigned to an open RFQ; supplier is logged in',
      '1. Open the RFQ quotation form\n2. For a specific line item, select "No Quote" response\n3. Submit',
      'Line item is marked with response status "no_quote". Procurement sees this in the quote matrix.',
      '','',''],
    ['TC-RFQ-006','Upload attachment to a quote line','Canvassing / RFQ',
      'A supplier has submitted a quote; supplier is logged in',
      '1. Open the submitted quotation\n2. On a specific line item, click "Attach File"\n3. Select a PDF or image file\n4. Upload',
      'File is uploaded to Supabase Storage. Attachment is linked to the specific rfq_item_quote. Procurement can view the attachment.',
      '','',''],
    ['TC-RFQ-007','Procurement closes the RFQ batch','Canvassing / RFQ',
      'An open RFQ with at least one supplier quote exists; user is procurement role',
      '1. Open the RFQ detail\n2. Review quote matrix\n3. Click "Close RFQ"\n4. Confirm',
      'RFQ status changes to "Closed". PR1 status updates to "Canvassing Complete". PR2 can now be created.',
      '','',''],
    ['TC-RFQ-008','Procurement reviews and decides on substitute proposal','Canvassing / RFQ',
      'A supplier has proposed a substitute item in their quote; user is procurement role',
      '1. Navigate to Substitute Review (/substitutes)\n2. Open the substitute proposal\n3. Review original vs proposed item\n4. Click "Accept" or "Reject"',
      'Decision is recorded. If accepted, the substitute item replaces the original in the PR2. Audit trail is updated.',
      '','',''],
  ],

  PO: [
    ['TC-PO-001','Generate PO from approved PR2 — registered supplier','Purchase Orders',
      'PR2 is in "Approved" status with line items awarded to a registered supplier; user is procurement role',
      '1. Navigate to Purchase Orders (/po)\n2. Click "New PO" or "Generate from PR2"\n3. Select the approved PR2\n4. Select the supplier candidate\n5. Enter PO number, PO date, delivery address, warehouse, payment terms, packing\n6. Click "Generate PO"',
      'PO is created in "Draft" status. PO items are populated from the PR2 lines for that supplier. PO number is unique.',
      '','',''],
    ['TC-PO-002','Generate PO with duplicate PO number','Purchase Orders',
      'A PO with number PO-2026-0001 already exists',
      '1. Attempt to generate a new PO\n2. Enter PO number PO-2026-0001\n3. Proceed',
      'System displays error: "PO number is already in use." PO is not created.',
      '','',''],
    ['TC-PO-003','Generate PO when PR2 is not yet approved','Purchase Orders',
      'PR2 exists with status other than "Approved"',
      '1. Attempt to generate a PO from a non-approved PR2',
      'System rejects the action with error: "PO can only be generated from a fully approved PR2."',
      '','',''],
    ['TC-PO-004','Update draft PO fields','Purchase Orders',
      'A PO in "Draft" status exists; user is procurement role',
      '1. Open the draft PO detail\n2. Edit delivery address, warehouse, payment terms, and remarks\n3. Click "Save"',
      'Updated fields are persisted. PO remains in Draft status.',
      '','',''],
    ['TC-PO-005','Submit PO for approval','Purchase Orders',
      'A draft PO exists; user is procurement role (Buyer or Procurement Staff)',
      '1. Open the draft PO\n2. Click "Submit for Approval"\n3. Confirm',
      'PO status changes to "For Approval". Approval workflow is started at step 1. Step 1 approver is notified.',
      '','',''],
    ['TC-PO-006','Generate multiple POs from PR2 with multiple suppliers','Purchase Orders',
      'PR2 is approved with items awarded to two different suppliers',
      '1. Generate PO for Supplier A from the PR2 candidate list\n2. Generate PO for Supplier B from the same PR2',
      'Two separate POs are created, each containing only their respective supplier\'s line items. No duplicate PO error is raised.',
      '','',''],
    ['TC-PO-007','Supplier views their Purchase Orders','Purchase Orders',
      'A PO exists with the logged-in supplier\'s supplier_id; user is logged in as supplier',
      '1. Navigate to Supplier PO (/supplier/po)\n2. Review list\n3. Open a specific PO',
      'Supplier sees only their own POs. PO detail shows items, delivery address, payment terms, and current status.',
      '','',''],
    ['TC-PO-008','Print a Purchase Order','Purchase Orders',
      'A PO exists in any status; user has access to the PO',
      '1. Open the PO detail\n2. Click "Print"\n3. View print layout',
      'Print view renders complete PO with header info, line items, grand total, supplier, and approval signatures.',
      '','',''],
  ],

  DEL: [
    ['TC-DEL-001','Delivery record auto-created on PO final approval','Delivery Tracking',
      'PO has completed the final approval step',
      '1. Approve PO at the final workflow step\n2. Navigate to Delivery Tracking (/delivery)',
      'A delivery record is automatically created with status "Pending". Delivery is linked to the approved PO.',
      '','',''],
    ['TC-DEL-002','Supplier sets commitment date','Delivery Tracking',
      'A delivery in "Pending" status is linked to the logged-in supplier',
      '1. Navigate to /supplier/delivery\n2. Open the pending delivery\n3. Enter a commitment date\n4. Save',
      'Commitment date is saved. Delivery status updates to "Scheduled". History trail records the change.',
      '','',''],
    ['TC-DEL-003','Supplier uploads DR document and reports actual delivery','Delivery Tracking',
      'A delivery exists with status "Scheduled" or "In Transit"; supplier is logged in',
      '1. Open the delivery from /supplier/delivery\n2. Enter DR number and DR date\n3. Upload DR document (PDF)\n4. Click "Report Delivery"',
      'DR document is uploaded to Supabase Storage. Delivery status changes to "Delivered". Warehouse/procurement is notified.',
      '','',''],
    ['TC-DEL-004','Procurement follows up — updates scheduled date','Delivery Tracking',
      'A delivery in Pending or Scheduled status exists; user is procurement or warehouse role',
      '1. Open delivery detail\n2. Enter a new scheduled date\n3. Add follow-up note\n4. Save',
      'Scheduled date is updated. History entry is added with actor name, role, and note.',
      '','',''],
    ['TC-DEL-005','Employee views delivery status for own request','Delivery Tracking',
      'Employee has a PR1 that has progressed to delivery stage; user is logged in as employee',
      '1. Navigate to Delivery Status (/delivery)\n2. Review delivery records for own requests',
      'Employee sees only deliveries linked to their own PR1 requests. Current delivery status and supplier name are visible.',
      '','',''],
    ['TC-DEL-006','View delivery history trail','Delivery Tracking',
      'Delivery record has undergone multiple status changes',
      '1. Open a delivery detail\n2. Scroll to the History section',
      'History trail shows all status transitions in chronological order with actor name, role, previous status, new status, and notes.',
      '','',''],
  ],

  GRN: [
    ['TC-GRN-001','Create GRN from a delivered PO','Goods Receipt Note',
      'A delivery with status "Delivered" exists; user is logged in as warehouse or procurement role',
      '1. Navigate to Goods Receipt (/grn)\n2. Click "Create GRN"\n3. Link to the delivered PO/delivery\n4. Enter received-by info, DR date, transaction date\n5. Enter quantity received and rejected per item\n6. Save',
      'GRN is created with auto-generated GRN number (GRN-YEAR-####). Status is "Open". Items are listed with ordered vs received quantities.',
      '','',''],
    ['TC-GRN-002','Record partial receipt — quantity received < quantity ordered','Goods Receipt Note',
      'A GRN is being created or is in Open status',
      '1. Open the GRN\n2. For a line item, enter quantity received less than quantity ordered\n3. Save',
      'Partial receipt is recorded. Quantity rejected can also be entered. GRN remains Open.',
      '','',''],
    ['TC-GRN-003','Enter quantity received exceeding quantity ordered','Goods Receipt Note',
      'A GRN is in Open status',
      '1. Open the GRN\n2. For a line item, enter quantity received > quantity ordered\n3. Attempt to save',
      'System validates and prevents saving. Error is displayed: received quantity cannot exceed ordered quantity.',
      '','',''],
    ['TC-GRN-004','Close a GRN','Goods Receipt Note',
      'An open GRN exists; all items have been verified; user is warehouse or procurement role',
      '1. Open the GRN detail\n2. Verify all quantities are correct\n3. Click "Close GRN"\n4. Confirm',
      'GRN status changes to "Closed". Closed timestamp is recorded. The linked PR1 lifecycle updates to "Completed (GRN Closed)".',
      '','',''],
    ['TC-GRN-005','Print GRN','Goods Receipt Note',
      'A GRN exists in any status',
      '1. Open GRN detail\n2. Click "Print"\n3. View print layout',
      'Print view renders complete GRN with header, line items (ordered/received/rejected), received-by signature line.',
      '','',''],
  ],

  SUPMGT: [
    ['TC-SUPMGT-001','Create supplier account manually','Supplier Management',
      'User is logged in as procurement role; required departments and positions exist',
      '1. Navigate to Supplier Accounts (/suppliers)\n2. Click "Create Supplier"\n3. Enter email, full name, department, position\n4. Click "Create"',
      'Supplier account is created in auth and profiles tables. Account has role = supplier. Temp password is generated.',
      '','',''],
    ['TC-SUPMGT-002','Invite supplier via email link','Supplier Management',
      'User is logged in as procurement role; Brevo/email is configured',
      '1. Navigate to Supplier Accounts\n2. Click "Invite Supplier"\n3. Enter supplier email and name\n4. Click "Send Invite"',
      'Invite email is sent to supplier email address. Supplier can complete their account via the invite link.',
      '','',''],
    ['TC-SUPMGT-003','Bulk import suppliers from CSV','Supplier Management',
      'User is procurement role; a valid CSV file with supplier data is prepared',
      '1. Navigate to Supplier Accounts\n2. Click "Bulk Import"\n3. Upload the CSV file\n4. Review parsed results\n5. Confirm import',
      'Suppliers are created from CSV rows. Rows with missing required fields are flagged. Successful imports appear in the supplier list.',
      '','',''],
    ['TC-SUPMGT-004','Deactivate a supplier account','Supplier Management',
      'An active supplier account exists; user is procurement or admin role',
      '1. Open the supplier detail page\n2. Click "Deactivate"\n3. Confirm in the dialog',
      'Supplier account is deactivated (active = false). Supplier cannot log in. Deactivation is reflected in the user list.',
      '','',''],
    ['TC-SUPMGT-005','Reactivate a supplier account','Supplier Management',
      'A deactivated supplier account exists; user is procurement or admin role',
      '1. Open the deactivated supplier detail\n2. Click "Reactivate"\n3. Confirm',
      'Supplier account is reactivated. Supplier can log in again.',
      '','',''],
    ['TC-SUPMGT-006','Admin sets supplier payment terms','Supplier Management',
      'A supplier profile exists; user is admin role',
      '1. Open the supplier profile\n2. Locate Payment Terms field\n3. Enter terms (e.g., "NET 30")\n4. Save',
      'Payment terms are saved on the supplier profile. Terms are auto-populated when a PO is generated for this supplier.',
      '','',''],
  ],

  ACCRED: [
    ['TC-ACCRED-001','Supplier submits accreditation application with documents','Supplier Accreditation',
      'User is logged in as supplier; supplier has not yet submitted an accreditation',
      '1. Navigate to /supplier/accreditation\n2. Click "Submit Accreditation"\n3. Upload required documents\n4. Submit',
      'Accreditation record is created with status "Pending". Documents are stored in Supabase Storage. Expiry date is calculated from submission date + configured validity days.',
      '','',''],
    ['TC-ACCRED-002','Procurement views accreditation review queue','Supplier Accreditation',
      'At least one accreditation is in Pending status; user is procurement role',
      '1. Navigate to Supplier Accreditation (/accreditation)\n2. Review the pending applications list',
      'Queue shows all pending accreditation submissions with supplier name, submission date, and status.',
      '','',''],
    ['TC-ACCRED-003','Procurement approves accreditation','Supplier Accreditation',
      'An accreditation application is in Pending status; user is procurement role',
      '1. Open the accreditation detail\n2. Review uploaded documents\n3. Click "Approve"\n4. Confirm',
      'Accreditation status changes to "Approved". Supplier is notified. Expiry date is set.',
      '','',''],
    ['TC-ACCRED-004','Procurement rejects accreditation','Supplier Accreditation',
      'An accreditation is in Pending status; user is procurement role',
      '1. Open the accreditation detail\n2. Click "Reject"\n3. Enter rejection reason\n4. Confirm',
      'Accreditation status changes to "Rejected". Supplier is notified with the reason.',
      '','',''],
    ['TC-ACCRED-005','Supplier withdraws their accreditation','Supplier Accreditation',
      'Supplier has a Pending accreditation; user is logged in as that supplier',
      '1. Navigate to /supplier/accreditation\n2. Click "Withdraw"\n3. Confirm',
      'Accreditation status changes to "Withdrawn". The application is removed from the procurement review queue.',
      '','',''],
    ['TC-ACCRED-006','System auto-expires accreditation past validity period','Supplier Accreditation',
      'An accreditation\'s expiry date has passed; Supabase cron job is running',
      '1. Wait for or simulate the pg_cron expiry job execution\n2. Check accreditation status after job runs',
      'Accreditation status is updated to "Expired" by the cron job. Expired accreditations are flagged in the procurement queue.',
      '','',''],
  ],

  PROD: [
    ['TC-PROD-001','Supplier adds a product to their catalog','Supplier Product Catalog',
      'User is logged in as supplier role; supplier has an approved accreditation',
      '1. Navigate to /supplier/products\n2. Click "Add Product"\n3. Enter product name, description, unit of measure, item type\n4. Save',
      'Product is created and linked to the supplier\'s accreditation. Product appears in the supplier\'s product catalog.',
      '','',''],
    ['TC-PROD-002','TSQA or Procurement gives "Passed" verdict on a product','Supplier Product Catalog',
      'A product exists in the product review queue; user is tsqa or procurement role',
      '1. Navigate to Product Review (/accreditation/products)\n2. Open a product under review\n3. Click "Pass"\n4. Confirm',
      'Product verdict is set to "Passed". Supplier is notified. Product is marked as accredited.',
      '','',''],
    ['TC-PROD-003','TSQA gives "Failed" verdict on a product','Supplier Product Catalog',
      'A product is pending review; user is tsqa or procurement role',
      '1. Open the product detail in the review queue\n2. Click "Fail"\n3. Enter failure reason\n4. Confirm',
      'Product verdict is set to "Failed". Supplier is notified. Product is not accredited.',
      '','',''],
    ['TC-PROD-004','Supplier withdraws a product from catalog','Supplier Product Catalog',
      'A supplier product exists; user is the supplier owner',
      '1. Navigate to /supplier/products\n2. Open the product\n3. Click "Withdraw"\n4. Confirm',
      'Product status changes to "Withdrawn". Product is removed from procurement\'s product review queue.',
      '','',''],
  ],

  TSQA: [
    ['TC-TSQA-001','TSQA views the RSE Queue','TSQA Module',
      'RSE records exist in created/assigned/under_review status; user is logged in as tsqa role',
      '1. Navigate to TSQA Dashboard (/tsqa)\n2. Click RSE Queue (/tsqa/rse)\n3. Review the list',
      'Queue displays RSE records with supplier name, document type, and current status (created, assigned, under_review).',
      '','',''],
    ['TC-TSQA-002','TSQA self-assigns an RSE record','TSQA Module',
      'An RSE record with status "created" exists in the queue; user is tsqa role',
      '1. Open an unassigned RSE record\n2. Click "Assign to me"\n3. Confirm',
      'RSE record status changes to "assigned" or "under_review". The TSQA user\'s profile is linked as assigned_to.',
      '','',''],
    ['TC-TSQA-003','TSQA submits review — result: Passed','TSQA Module',
      'An RSE record assigned to the logged-in TSQA user exists',
      '1. Open the assigned RSE record\n2. Enter test findings and remarks\n3. Select result: "Passed"\n4. Submit',
      'RSE record status changes to "completed" with result "passed". Procurement is notified. Related product review outcome is updated.',
      '','',''],
    ['TC-TSQA-004','TSQA submits review — result: Failed','TSQA Module',
      'An RSE record is assigned to the logged-in TSQA user',
      '1. Open the assigned RSE record\n2. Enter test findings explaining failure\n3. Select result: "Failed"\n4. Submit',
      'RSE record status changes to "completed" with result "failed". Procurement and relevant parties are notified.',
      '','',''],
  ],

  MSG: [
    ['TC-MSG-001','Start a new conversation with another user','Messaging',
      'At least two active user accounts exist; user is logged in',
      '1. Navigate to Messages (/messages)\n2. Click "New Conversation"\n3. Search for another user by name\n4. Select the user\n5. Send an initial message',
      'Conversation is created. The recipient sees the conversation in their inbox. Initial message appears in the thread.',
      '','',''],
    ['TC-MSG-002','Send a message in an existing conversation','Messaging',
      'A conversation thread exists; user is a participant',
      '1. Open an existing conversation\n2. Type a message in the input field\n3. Press Send',
      'Message appears in the thread with sender name and timestamp. Recipient\'s unread count increases.',
      '','',''],
    ['TC-MSG-003','Send a message with a file attachment','Messaging',
      'An existing conversation thread exists; user is logged in',
      '1. Open the conversation\n2. Click the attachment icon\n3. Select a file\n4. Send',
      'File is uploaded to Supabase Storage. Message with attachment preview appears in the thread.',
      '','',''],
    ['TC-MSG-004','Unread message count badge updates','Messaging',
      'A new message is sent to the logged-in user in a conversation they have not read',
      '1. Log in as the recipient\n2. Observe the Messages icon in the navigation',
      'An unread badge appears on the message icon showing the count of unread messages.',
      '','',''],
  ],

  NOTIF: [
    ['TC-NOTIF-001','Notification appears after PR1 is submitted','Notifications',
      'An employee submits a PR1; an approver exists for step 1 of the PR1 workflow',
      '1. Employee submits a PR1\n2. Log in as the step-1 approver\n3. Check the notification bell',
      'Notification bell shows an unread count. Notification list includes an entry for the submitted PR1 with action URL.',
      '','',''],
    ['TC-NOTIF-002','Mark a notification as read','Notifications',
      'Unread notifications exist for the logged-in user',
      '1. Click the notification bell\n2. Open the notification list\n3. Click on a specific notification',
      'Notification is marked as read. Unread count decreases by 1.',
      '','',''],
    ['TC-NOTIF-003','Notification action URL navigates to the document','Notifications',
      'A notification with an action_url exists for the logged-in user',
      '1. Open the notification list\n2. Click the action link on a notification',
      'User is navigated to the relevant document (e.g., the PR1 detail page, PO detail) referenced by the notification.',
      '','',''],
  ],

  DASH: [
    ['TC-DASH-001','Employee dashboard shows My Requests summary','Dashboards',
      'Employee has submitted PR1 requests in various statuses',
      '1. Log in as employee\n2. Navigate to Dashboard (/dashboard)',
      'Dashboard shows count and status breakdown of the employee\'s PR1 requests (draft, pending, approved, completed).',
      '','',''],
    ['TC-DASH-002','Approver dashboard shows pending approval counts','Dashboards',
      'Documents are pending approval at a step matching the approver\'s role and position',
      '1. Log in as approver\n2. Navigate to Dashboard',
      'Dashboard shows pending count for PR1, PR2, and PO approvals. Counts match the Approval Queue.',
      '','',''],
    ['TC-DASH-003','Procurement dashboard shows RFQ and PO pipeline','Dashboards',
      'Multiple RFQ and PO records exist in various statuses',
      '1. Log in as procurement\n2. Navigate to Dashboard',
      'Dashboard displays RFQ pipeline stats and PO status breakdown (draft, for approval, approved).',
      '','',''],
    ['TC-DASH-004','Admin dashboard shows system KPIs','Dashboards',
      'Users and documents exist in the system; user is logged in as admin',
      '1. Log in as admin\n2. Navigate to Dashboard',
      'Dashboard shows total user counts by role, document pipeline stats, and system health indicators.',
      '','',''],
    ['TC-DASH-005','Supplier dashboard shows outstanding quotations','Dashboards',
      'Supplier is assigned to open RFQs; user is logged in as supplier',
      '1. Log in as supplier\n2. Navigate to Dashboard',
      'Dashboard shows count of open RFQ quotations requiring response and outstanding POs.',
      '','',''],
    ['TC-DASH-006','Warehouse dashboard shows validation queue count','Dashboards',
      'PR1 records exist in Pending Warehouse status; user is warehouse role',
      '1. Log in as warehouse\n2. Navigate to Dashboard',
      'Dashboard shows count of PR1 records pending warehouse validation.',
      '','',''],
  ],

  ADMUSR: [
    ['TC-ADMUSR-001','Admin creates a new user account','Admin – User Management',
      'User is logged in as admin; roles, departments, and positions exist in master data',
      '1. Navigate to /admin/users\n2. Click "Create User"\n3. Enter email, full name, select role, department, position\n4. Optionally enter password\n5. Click Create',
      'User is created in Supabase Auth and profiles table. A temporary password is generated if none provided. User appears in the user list.',
      '','',''],
    ['TC-ADMUSR-002','Create user with invalid email format','Admin – User Management',
      'User is logged in as admin',
      '1. Open Create User form\n2. Enter malformed email (e.g., "notanemail")\n3. Submit',
      'System displays validation error: "Invalid email format". User is not created.',
      '','',''],
    ['TC-ADMUSR-003','Create user with password less than 8 characters','Admin – User Management',
      'User is logged in as admin',
      '1. Open Create User form\n2. Enter a valid email and fill required fields\n3. Enter password "abc" (3 chars)\n4. Submit',
      'System rejects the request with error: "Password must be at least 8 characters".',
      '','',''],
    ['TC-ADMUSR-004','Admin invites user via email','Admin – User Management',
      'User is admin; email service is configured',
      '1. Navigate to /admin/users\n2. Click "Invite User"\n3. Enter recipient email and details\n4. Send Invite',
      'Invite email is sent. User receives an invite link to complete account setup.',
      '','',''],
    ['TC-ADMUSR-005','Edit user role, department, and position','Admin – User Management',
      'A user account exists; admin is logged in',
      '1. Navigate to user detail (/admin/users/[id])\n2. Click "Edit Assignment"\n3. Change role, department, or position\n4. Save',
      'User profile is updated. Changes take effect on the user\'s next login or page reload. Middleware re-evaluates route access based on new role.',
      '','',''],
    ['TC-ADMUSR-006','Deactivate a user — immediate access revocation','Admin – User Management',
      'An active user account exists (non-admin); admin is logged in',
      '1. Open user detail\n2. Click "Deactivate User"\n3. Confirm',
      'User account is deactivated (active = false). If the user is logged in, they are signed out on their next request. They cannot log in again.',
      '','',''],
    ['TC-ADMUSR-007','Admin resets a user\'s password','Admin – User Management',
      'A user account exists; admin is logged in',
      '1. Open user detail\n2. Click "Reset Password"\n3. Enter new password\n4. Confirm',
      'User\'s password is updated via Supabase admin API. User can log in with the new password.',
      '','',''],
  ],

  ADMMD: [
    ['TC-ADMMD-001','Create a new department','Admin – Master Data',
      'User is logged in as admin',
      '1. Navigate to /admin/departments\n2. Click "Add Department"\n3. Enter department name\n4. Save',
      'Department is created and marked active. It is immediately available for assignment when creating/editing users.',
      '','',''],
    ['TC-ADMMD-002','Deactivate a department','Admin – Master Data',
      'An active department exists; user is admin',
      '1. Navigate to /admin/departments\n2. Open the department\n3. Click "Deactivate"\n4. Confirm',
      'Department is marked inactive. It no longer appears in department selection dropdowns for new users.',
      '','',''],
    ['TC-ADMMD-003','Create a new position','Admin – Master Data',
      'User is logged in as admin',
      '1. Navigate to /admin/positions\n2. Click "Add Position"\n3. Enter position title\n4. Save',
      'Position is created and marked active. It is available for assignment when creating/editing users.',
      '','',''],
    ['TC-ADMMD-004','View roles list','Admin – Master Data',
      'User is logged in as admin',
      '1. Navigate to /admin/roles\n2. Review the roles list',
      'All system roles are displayed (employee, warehouse, procurement, approver, supplier, tsqa, admin). Roles are read-only.',
      '','',''],
  ],

  ADMWF: [
    ['TC-ADMWF-001','View workflow definitions','Admin – Workflows',
      'User is logged in as admin; workflows are configured',
      '1. Navigate to /admin/workflows\n2. Review the workflow list',
      'All configured workflows are displayed (PR1_APPROVAL, PR2_APPROVAL, PO_APPROVAL). Steps are visible with role, position, and sequence.',
      '','',''],
    ['TC-ADMWF-002','Add a workflow step','Admin – Workflows',
      'A workflow definition exists; user is admin',
      '1. Open a workflow\n2. Click "Add Step"\n3. Enter step order, required role, required position, is_final flag\n4. Save',
      'New step is added to the workflow in the correct sequence. Approval routing uses the updated workflow on next document submission.',
      '','',''],
    ['TC-ADMWF-003','Edit an existing workflow step','Admin – Workflows',
      'A workflow with at least one step exists; user is admin',
      '1. Open a workflow\n2. Open an existing step\n3. Change the required position or role\n4. Save',
      'Step is updated. Existing approval instances in progress are not affected; new submissions use the updated step.',
      '','',''],
    ['TC-ADMWF-004','Delete a workflow step','Admin – Workflows',
      'A non-final workflow step exists; user is admin',
      '1. Open a workflow\n2. Select a step\n3. Click "Delete"\n4. Confirm in the delete dialog',
      'Step is permanently removed. Workflow resequences remaining steps if needed.',
      '','',''],
  ],

  ADMVIS: [
    ['TC-ADMVIS-001','Hide a module from a specific role','Admin – Module Visibility',
      'A module is currently visible for a role; user is admin',
      '1. Navigate to /admin/module-visibility\n2. Select the role\n3. Toggle a module to "Hidden"\n4. Save',
      'Module is hidden from the sidebar for that role. Users with that role no longer see the module in navigation.',
      '','',''],
    ['TC-ADMVIS-002','Add an extra module to a role (Add Mode)','Admin – Module Visibility',
      'A module is not in the default nav for a role; user is admin',
      '1. Navigate to /admin/module-visibility\n2. Select the role\n3. Use "Add Module" to add an extra module from another role\'s nav\n4. Save',
      'Module appears in the sidebar for that role. The borrowed module is inserted at the configured position.',
      '','',''],
    ['TC-ADMVIS-003','Verify module hidden after configuration','Admin – Module Visibility',
      'A module has been hidden for the "employee" role via admin configuration',
      '1. Log in as a user with employee role\n2. Check the sidebar navigation',
      'The hidden module does not appear in the sidebar. The employee cannot navigate to that module.',
      '','',''],
  ],

  ADMAUD: [
    ['TC-ADMAUD-001','View audit log list','Admin – Audit Logs',
      'Audit log entries exist; user is logged in as admin',
      '1. Navigate to /admin/audit\n2. View the audit log table',
      'Audit logs are displayed with actor name, action type, document type, document ID, and timestamp.',
      '','',''],
    ['TC-ADMAUD-002','Filter audit logs by action type','Admin – Audit Logs',
      'Multiple audit log types exist; user is admin',
      '1. Open audit logs\n2. Apply filter for action type "PR1_SUBMITTED"\n3. Review results',
      'Only audit entries with action type PR1_SUBMITTED are shown. Other action types are excluded.',
      '','',''],
    ['TC-ADMAUD-003','View audit log detail entry','Admin – Audit Logs',
      'Audit log entries exist; user is admin',
      '1. Open a specific audit log entry\n2. View the detail panel',
      'Full audit detail is shown including actor ID, document ID, payload JSON with change details.',
      '','',''],
  ],

  ADMSET: [
    ['TC-ADMSET-001','Update accreditation validity days','Admin – System Settings',
      'User is logged in as admin',
      '1. Navigate to /admin/settings\n2. Locate "Accreditation Validity Days"\n3. Change the value (e.g., from 365 to 730)\n4. Save',
      'Setting is updated. New supplier accreditation submissions will have expiry calculated using the new validity period.',
      '','',''],
    ['TC-ADMSET-002','Update product validity days','Admin – System Settings',
      'User is logged in as admin',
      '1. Navigate to /admin/settings\n2. Locate "Product Validity Days"\n3. Change the value\n4. Save',
      'Setting is updated. New product submissions will use the new validity period for expiry calculation.',
      '','',''],
    ['TC-ADMSET-003','Enter invalid validity value (zero or negative)','Admin – System Settings',
      'User is logged in as admin',
      '1. Open System Settings\n2. Enter 0 or a negative number in "Accreditation Validity Days"\n3. Attempt to save',
      'System validates input and rejects the value. Error message is displayed indicating the value must be a positive integer.',
      '','',''],
  ],

  BUG: [
    ['TC-BUG-001','Submit a bug report','Bug Tracking',
      'User is logged in (any role); bug tracking module is enabled',
      '1. Navigate to /bugtrack\n2. Click "Report Bug"\n3. Enter bug title, description, severity\n4. Submit',
      'Bug report is created and visible in the bug list. Email notification is sent to the configured recipient.',
      '','',''],
    ['TC-BUG-002','Generate AI-ready prompt for a bug','Bug Tracking',
      'A bug report exists; user is logged in',
      '1. Open a bug report\n2. Click "AI Ready Prompt"\n3. View the generated prompt',
      'A structured prompt is generated combining the bug report details into a format suitable for AI debugging assistance.',
      '','',''],
    ['TC-BUG-003','View bug tracking list','Bug Tracking',
      'Bug reports have been submitted; user is logged in',
      '1. Navigate to /bugtrack\n2. Review the list',
      'All submitted bug reports are visible with title, status, and submission date.',
      '','',''],
  ],

  PROF: [
    ['TC-PROF-001','View own profile','Profile Management',
      'User is logged in (any role)',
      '1. Navigate to /profile\n2. Review displayed information',
      'Profile page shows user\'s full name, email, role, department, and position. Fields are read-only for non-editable attributes.',
      '','',''],
    ['TC-PROF-002','Supplier updates payment terms on profile','Profile Management',
      'User is logged in as supplier role',
      '1. Navigate to /profile\n2. Locate Payment Terms field\n3. Enter or update terms (e.g., "NET 30")\n4. Save',
      'Payment terms are saved on the supplier\'s profile. Updated terms are used as default when POs are generated for this supplier.',
      '','',''],
    ['TC-PROF-003','Non-supplier cannot edit payment terms','Profile Management',
      'User is logged in as employee, procurement, or other non-supplier role',
      '1. Navigate to /profile\n2. Check for Payment Terms field',
      'Payment Terms field is not displayed or is not editable for non-supplier roles.',
      '','',''],
  ],

  TRACE: [
    ['TC-TRACE-001','View compliance traceability from PR2 detail','Compliance / Traceability',
      'A PR2 with linked PR1, RFQ, and PO records exists; user is procurement or approver',
      '1. Open a PR2 detail\n2. Locate the Compliance Traceability section',
      'Full document chain is displayed: PR1 number → RFQ number → PR2 number → PO number → Delivery status → GRN status. All document numbers and statuses are correct.',
      '','',''],
    ['TC-TRACE-002','View traceability from PO detail','Compliance / Traceability',
      'A PO with linked PR2, PR1, RFQ records exists; user has access to the PO',
      '1. Open a PO detail\n2. Locate the Compliance Traceability section',
      'Document chain is displayed from the PO perspective showing all upstream references (PR1, RFQ, PR2).',
      '','',''],
    ['TC-TRACE-003','Traceability chain is complete for a fully processed request','Compliance / Traceability',
      'A PR1 has progressed through the complete lifecycle (PR1 → RFQ → PR2 → PO → Delivery → GRN)',
      '1. Open the final PO or PR2 detail\n2. View the full traceability chain',
      'All 6 stages are visible in the chain. Each stage shows the document number, status, and a navigation link to its detail page.',
      '','',''],
  ],
};

// ─── Cross-cutting test cases ──────────────────────────────────────────────────
const TC_CROSS = {
  authz: [
    ['TC-CROSS-001','Employee cannot access procurement routes','Cross-Cutting – Authorization',
      'User is logged in as employee role',
      '1. Attempt to navigate to /rfq, /pr2, /po, or /suppliers directly',
      'System redirects to /dashboard with access=denied parameter. Employee role is blocked from procurement routes.',
      '','',''],
    ['TC-CROSS-002','Supplier cannot access admin routes','Cross-Cutting – Authorization',
      'User is logged in as supplier role',
      '1. Attempt to navigate to /admin/users or any /admin route',
      'System redirects to /dashboard with access=denied. Admin routes are blocked for supplier role.',
      '','',''],
    ['TC-CROSS-003','Director can approve documents across departments','Cross-Cutting – Authorization',
      'A document from a different department is pending approval at a Director step; user has Director position',
      '1. Log in as an approver with Director position\n2. Open the cross-department document from the approval queue\n3. Approve',
      'Director is allowed to approve documents regardless of department. Approval action succeeds.',
      '','',''],
  ],
  validation: [
    ['TC-CROSS-004','Required fields prevent form submission when blank','Cross-Cutting – Validation',
      'Any form with required fields (PR1, PO, GRN, etc.)',
      '1. Open a creation form\n2. Leave required fields blank\n3. Attempt to submit',
      'Form displays field-level validation errors for all blank required fields. Submission is blocked.',
      '','',''],
    ['TC-CROSS-005','Date fields reject invalid date formats','Cross-Cutting – Validation',
      'Any form with a date field',
      '1. Open a form with a date field (e.g., Date Required on PR1)\n2. Attempt to enter an invalid date format\n3. Submit',
      'Date picker enforces valid date selection. Invalid dates cannot be entered manually.',
      '','',''],
  ],
  rbac: [
    ['TC-CROSS-006','Role-based sidebar shows only allowed modules','Cross-Cutting – RBAC',
      'Multiple users with different roles are available for testing',
      '1. Log in as employee\n2. Note sidebar items\n3. Log in as procurement\n4. Note sidebar items\n5. Compare with navigation config',
      'Each role sees exactly the modules defined in ROLE_NAV config. No cross-role modules are visible unless explicitly added via module visibility.',
      '','',''],
    ['TC-CROSS-007','Inactive users are automatically signed out','Cross-Cutting – RBAC',
      'A user with an active session is deactivated by admin',
      '1. Log in as a user\n2. Admin deactivates that user (different browser/tab)\n3. User attempts navigation in original session',
      'On next request, middleware detects active=false, signs the user out, and redirects to /login.',
      '','',''],
  ],
  data: [
    ['TC-CROSS-008','Audit logs are created for all major mutations','Cross-Cutting – Data Integrity',
      'Admin is logged in; audit logs module is accessible',
      '1. Perform a series of actions (create PR1, submit, approve, generate PO)\n2. Navigate to /admin/audit',
      'Each major action produces an audit log entry with correct actor_id, action type, document_type, document_id, and payload.',
      '','',''],
    ['TC-CROSS-009','Document numbers are unique across the system','Cross-Cutting – Data Integrity',
      'Multiple documents exist in the system',
      '1. Attempt to create two PR1s with the same PR1 number\n2. Attempt to create two POs with the same PO number',
      'System rejects duplicates at both validation and database constraint levels. Error messages are displayed.',
      '','',''],
  ],
};

// ─── Sign-off table ────────────────────────────────────────────────────────────
function makeSignOffTable() {
  const signOffHeaders = ['Name','Role / Title','Department','Signature','Date','Sign-Off Status'];
  const signOffWidths = [1500, 1600, 1600, 1626, 1200, 1500];
  const headerRow = new TableRow({
    tableHeader: true,
    children: signOffHeaders.map((h, i) =>
      new TableCell({
        borders: BORDERS,
        width: { size: signOffWidths[i], type: WidthType.DXA },
        shading: { fill: COLORS.tableHeader, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, font: 'Arial' })] })],
      })
    ),
  });
  const blankRows = Array.from({ length: 5 }, (_, i) =>
    new TableRow({
      children: signOffHeaders.map((_, ci) =>
        new TableCell({
          borders: BORDERS,
          width: { size: signOffWidths[ci], type: WidthType.DXA },
          shading: { fill: i % 2 === 1 ? COLORS.lightGray : COLORS.white, type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: '', size: 18, font: 'Arial' })] })],
        })
      ),
    })
  );
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: signOffWidths,
    rows: [headerRow, ...blankRows],
  });
}

// ─── Build document ────────────────────────────────────────────────────────────
function buildDoc() {
  const children = [];

  // ── Cover Page ──────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ children: [], spacing: { after: 2000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'USER ACCEPTANCE TESTING (UAT) DOCUMENT', bold: true, size: 48, font: 'Arial', color: '2E75B6' })],
      spacing: { after: 400 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Fortune Procurement System', bold: true, size: 36, font: 'Arial' })],
      spacing: { after: 200 },
    }),
    new Paragraph({ children: [], spacing: { after: 1200 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Version: 1.0', size: 24, font: 'Arial' })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Prepared by: System UAT Auditor', size: 24, font: 'Arial' })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Date: June 25, 2026', size: 24, font: 'Arial' })],
      spacing: { after: 120 },
    }),
    new Paragraph({ children: [], spacing: { after: 1200 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'CONFIDENTIAL', bold: true, size: 20, font: 'Arial', color: 'CC0000' })],
    }),
    pageBreak(),
  );

  // ── 1. Document Overview ─────────────────────────────────────────────────────
  children.push(h1('1. Document Overview'));

  children.push(h2('1.1 Purpose'));
  children.push(para('This User Acceptance Testing (UAT) document defines the test cases for the Fortune Procurement System. It is intended to guide testing stakeholders through structured verification of all system modules and functionalities derived directly from the codebase audit. Each test case traces to actual implemented features.'));

  children.push(h2('1.2 Scope'));
  children.push(para('This document covers all 25 modules identified in the system audit, including:'));
  children.push(bullet('Authentication and session management'));
  children.push(bullet('Purchase requisition lifecycle (PR1, Warehouse Validation, PR2, Approvals)'));
  children.push(bullet('Canvassing, RFQ, and Purchase Order management'));
  children.push(bullet('Delivery tracking and Goods Receipt Note (GRN)'));
  children.push(bullet('Supplier management, accreditation, and product catalog'));
  children.push(bullet('TSQA module, messaging, and notifications'));
  children.push(bullet('Admin functions: user management, master data, workflows, module visibility, audit logs, and system settings'));
  children.push(bullet('Cross-cutting concerns: authorization, validation, RBAC, and data integrity'));

  children.push(h2('1.3 References — Files Audited'));
  children.push(para('Primary source files audited for this UAT:'));
  [
    'middleware.ts, config/navigation.ts, config/module-route-map.ts',
    'lib/pr1.ts, lib/pr2.ts, lib/pr2-approvals.ts',
    'lib/canvassing.ts, lib/po.ts, lib/po-approvals.ts',
    'lib/warehouse.ts, lib/grn.ts, lib/delivery.ts',
    'lib/accreditation.ts, lib/supplier-products.ts, lib/tsqa.ts, lib/rse.ts',
    'lib/admin-users.ts, lib/admin-masterdata.ts, lib/workflow-admin.ts',
    'lib/module-visibility.ts, lib/system-settings.ts, lib/audit.ts',
    'lib/messages.ts, lib/notifications.ts, lib/bugtrack.ts, lib/profile.ts',
    'app/api/admin/users/create/route.ts, app/api/procurement/suppliers/',
    'supabase/migrations/ (50+ migration files defining schema and RLS)',
  ].forEach(f => children.push(bullet(f)));

  children.push(pageBreak());

  // ── 2. System Overview ───────────────────────────────────────────────────────
  children.push(h1('2. System Overview'));

  children.push(h2('2.1 System Description'));
  children.push(para('The Fortune Procurement System is a full-stack web application that digitizes and automates the end-to-end procurement workflow of an organization. The system supports the complete lifecycle from employee purchase requisition through canvassing, vendor selection, purchase order issuance, delivery tracking, and goods receipt. Supplier accreditation, quality review, and administrative governance features are also included.'));

  children.push(h2('2.2 Tech Stack'));
  children.push(bullet('Frontend Framework: Next.js 13.5.1 (App Router, React 18)'));
  children.push(bullet('UI: Radix UI / shadcn/ui, Tailwind CSS, Lucide icons'));
  children.push(bullet('Database: Supabase (PostgreSQL) with Row Level Security (RLS) policies'));
  children.push(bullet('Authentication: Supabase Auth (email/password, invite links, password reset)'));
  children.push(bullet('File Storage: Supabase Storage (PR1 attachments, DR documents, quote attachments, message files)'));
  children.push(bullet('Email: Brevo / Resend with React Email templates'));
  children.push(bullet('Forms: React Hook Form + Zod validation'));
  children.push(bullet('Hosting: Netlify'));

  children.push(h2('2.3 Roles'));
  children.push(para('The system defines 7 application roles, each with a specific set of allowed modules:'));
  [
    'employee — Creates and tracks purchase requisitions (PR1)',
    'warehouse — Validates inventory, manages GRN, tracks deliveries',
    'procurement — Manages RFQ, PR2, PO generation, supplier accounts, accreditation',
    'approver — Approves PR1, PR2, and PO documents through configured workflows',
    'supplier — Submits quotations, views POs, reports deliveries, manages catalog and accreditation',
    'tsqa — Reviews RSE records and gives verdict on supplier product quality',
    'admin — Full administrative control over users, master data, workflows, and system settings',
  ].forEach(r => children.push(bullet(r)));

  children.push(h2('2.4 Modules Covered'));
  const moduleList = [
    '1. Authentication & Session Management',
    '2. PR1 – Purchase Requisition 1',
    '3. Warehouse Validation',
    '4. Approvals (PR1, PR2, PO)',
    '5. PR2 – Purchase Request 2',
    '6. Canvassing / RFQ',
    '7. Purchase Orders (PO)',
    '8. Delivery Tracking',
    '9. Goods Receipt Note (GRN)',
    '10. Supplier Management',
    '11. Supplier Accreditation',
    '12. Supplier Product Catalog',
    '13. TSQA Module',
    '14. Messaging',
    '15. In-App Notifications',
    '16. Role-Specific Dashboards',
    '17. Admin – User Management',
    '18. Admin – Master Data',
    '19. Admin – Workflow Management',
    '20. Admin – Module Visibility',
    '21. Admin – Audit Logs',
    '22. Admin – System Settings',
    '23. Bug Tracking',
    '24. Profile Management',
    '25. Compliance / Traceability',
  ];
  moduleList.forEach(m => children.push(bullet(m)));

  children.push(pageBreak());

  // ── 3. Testing Approach ──────────────────────────────────────────────────────
  children.push(h1('3. Testing Approach'));

  children.push(h2('3.1 Testing Methodology'));
  children.push(para('Each module is tested following this coverage structure:'));
  children.push(bullet('Happy Path — Valid inputs, successful outcomes (primary flow)'));
  children.push(bullet('Negative Cases — Invalid inputs, unauthorized access, boundary violations'));
  children.push(bullet('Edge Cases — Partial data, status state transitions, multi-actor scenarios'));

  children.push(h2('3.2 Entry and Exit Criteria'));
  children.push(h3('Entry Criteria'));
  children.push(bullet('The system is deployed and accessible at the test environment URL'));
  children.push(bullet('Demo or test accounts for all 7 roles are created and active'));
  children.push(bullet('Supabase database is seeded with baseline master data (departments, positions, roles, workflow definitions)'));
  children.push(bullet('Email delivery service is configured and operational for invite/reset flows'));

  children.push(h3('Exit Criteria'));
  children.push(bullet('All test cases have been executed with Actual Result and Status filled in'));
  children.push(bullet('All Critical and High severity failures are resolved or formally accepted'));
  children.push(bullet('UAT Sign-Off table is signed by all designated stakeholders'));

  children.push(h2('3.3 Test Environment Requirements'));
  children.push(bullet('Test URL: accessible instance of the Fortune Procurement System (staging/UAT)'));
  children.push(bullet('Supabase project with all migrations applied'));
  children.push(bullet('Test user accounts: one per role minimum (7 accounts)'));
  children.push(bullet('Email inbox access for invite and reset password test flows'));
  children.push(bullet('File samples: PDF and image files for attachment upload tests'));
  children.push(bullet('CSV file: prepared supplier import CSV for bulk import test'));
  children.push(bullet('Browser: latest Chrome or Edge (recommended)'));

  children.push(h2('3.4 Roles and Responsibilities'));
  children.push(bullet('UAT Coordinator — Manages test scheduling and tracks results'));
  children.push(bullet('Employee Tester — Executes PR1 and employee-facing test cases'));
  children.push(bullet('Warehouse Tester — Executes warehouse validation and GRN test cases'));
  children.push(bullet('Procurement Tester — Executes RFQ, PO, and supplier management test cases'));
  children.push(bullet('Approver Tester — Executes all approval workflow test cases'));
  children.push(bullet('Supplier Tester — Executes supplier portal test cases (quotations, delivery, accreditation)'));
  children.push(bullet('TSQA Tester — Executes TSQA RSE review test cases'));
  children.push(bullet('Admin Tester — Executes all admin module test cases'));

  children.push(pageBreak());

  // ── 4. Test Cases per Module ─────────────────────────────────────────────────
  children.push(h1('4. Test Cases by Module'));
  children.push(spacer());

  const modules = [
    { title: '4.1 Authentication & Session Management', key: 'AUTH' },
    { title: '4.2 PR1 – Purchase Requisition 1', key: 'PR1' },
    { title: '4.3 Warehouse Validation', key: 'WH' },
    { title: '4.4 Approvals (PR1 / PR2 / PO)', key: 'APR' },
    { title: '4.5 PR2 – Purchase Request 2', key: 'PR2' },
    { title: '4.6 Canvassing / RFQ', key: 'RFQ' },
    { title: '4.7 Purchase Orders (PO)', key: 'PO' },
    { title: '4.8 Delivery Tracking', key: 'DEL' },
    { title: '4.9 Goods Receipt Note (GRN)', key: 'GRN' },
    { title: '4.10 Supplier Management', key: 'SUPMGT' },
    { title: '4.11 Supplier Accreditation', key: 'ACCRED' },
    { title: '4.12 Supplier Product Catalog', key: 'PROD' },
    { title: '4.13 TSQA Module', key: 'TSQA' },
    { title: '4.14 Messaging', key: 'MSG' },
    { title: '4.15 In-App Notifications', key: 'NOTIF' },
    { title: '4.16 Role-Specific Dashboards', key: 'DASH' },
    { title: '4.17 Admin – User Management', key: 'ADMUSR' },
    { title: '4.18 Admin – Master Data', key: 'ADMMD' },
    { title: '4.19 Admin – Workflow Management', key: 'ADMWF' },
    { title: '4.20 Admin – Module Visibility', key: 'ADMVIS' },
    { title: '4.21 Admin – Audit Logs', key: 'ADMAUD' },
    { title: '4.22 Admin – System Settings', key: 'ADMSET' },
    { title: '4.23 Bug Tracking', key: 'BUG' },
    { title: '4.24 Profile Management', key: 'PROF' },
    { title: '4.25 Compliance / Traceability', key: 'TRACE' },
  ];

  modules.forEach(({ title, key }, mi) => {
    children.push(h2(title));
    children.push(spacer());
    children.push(makeTCTable(TC[key]));
    children.push(spacer());
    if (mi < modules.length - 1) {
      children.push(pageBreak());
    }
  });

  children.push(pageBreak());

  // ── 5. Cross-Cutting Test Cases ──────────────────────────────────────────────
  children.push(h1('5. Cross-Cutting Test Cases'));
  children.push(spacer());

  children.push(h2('5.1 Authentication & Authorization'));
  children.push(makeTCTable(TC_CROSS.authz));
  children.push(spacer());

  children.push(h2('5.2 Error Handling & Validation'));
  children.push(makeTCTable(TC_CROSS.validation));
  children.push(spacer());

  children.push(h2('5.3 Role-Based Access Control'));
  children.push(makeTCTable(TC_CROSS.rbac));
  children.push(spacer());

  children.push(h2('5.4 Data Integrity'));
  children.push(makeTCTable(TC_CROSS.data));
  children.push(spacer());

  children.push(pageBreak());

  // ── 6. UAT Sign-Off ──────────────────────────────────────────────────────────
  children.push(h1('6. UAT Sign-Off'));

  children.push(h2('6.1 Sign-Off Criteria'));
  children.push(para('UAT is considered complete and sign-off may proceed when:'));
  children.push(bullet('All test cases have been executed (Actual Result and Status columns filled)'));
  children.push(bullet('Zero Critical defects remain open'));
  children.push(bullet('All High defects are either resolved or have an accepted workaround documented'));
  children.push(bullet('Medium and Low defects have a resolution plan or are deferred to the next release'));
  children.push(bullet('All designated stakeholders have reviewed results and signed below'));

  children.push(h2('6.2 Sign-Off Table'));
  children.push(spacer());
  children.push(makeSignOffTable());
  children.push(spacer());
  children.push(para('By signing this document, each stakeholder confirms that the Fortune Procurement System meets the acceptance criteria for their area of responsibility.'));

  // ─── Assemble document ────────────────────────────────────────────────────────
  return new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{
            level: 0,
            format: LevelFormat.BULLET,
            text: '•',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
      ],
    },
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 20 } },
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Arial', color: '2E75B6' },
          paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial', color: '2E75B6' },
          paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: 'Arial', color: '1F5C99' },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: A4_W, height: A4_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'Fortune Procurement System — UAT Document', size: 16, font: 'Arial', color: '666666' }),
              new TextRun({ text: '\t\t', size: 16, font: 'Arial' }),
              new TextRun({ text: 'v1.0 | June 2026', size: 16, font: 'Arial', color: '666666' }),
            ],
            tabStops: [{ type: 'right', position: CONTENT_W }],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' } },
            spacing: { after: 0 },
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', size: 16, font: 'Arial', color: '888888' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '888888' }),
              new TextRun({ text: ' of ', size: 16, font: 'Arial', color: '888888' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: 'Arial', color: '888888' }),
            ],
          })],
        }),
      },
      children,
    }],
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'UAT_FortuneProcurementSystem_v1.0.docx');

console.log('Generating UAT document...');
const doc = buildDoc();
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer);
  console.log('Done! Saved to:', outPath);
}).catch(err => {
  console.error('Error generating document:', err);
  process.exit(1);
});
