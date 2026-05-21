# Workflow Admin Configuration - Deployment Checklist

**Version**: 1.0  
**Last Updated**: May 21, 2026  
**Status**: Ready for Deployment

---

## 📋 Pre-Deployment Checklist

### 1. Code Review

- ✅ All Phase 1-5 files created
- ✅ TypeScript compilation successful
- ✅ Build process completed without errors
- ✅ No console errors or warnings
- ✅ Code follows project patterns and conventions

### 2. Database Preparation

- [ ] **Backup Production Database**
  ```bash
  # Using Supabase CLI or dashboard
  # Export approval_workflows table
  # Export approval_steps table
  # Export approval_instances table (for reference)
  ```

- [ ] **Verify RLS Policies**
  ```sql
  -- Check that admins can modify workflow steps
  SELECT * FROM pg_policies 
  WHERE tablename IN ('approval_workflows', 'approval_steps');
  ```

- [ ] **Check Data Integrity**
  ```sql
  -- Verify all workflows have at least one step
  SELECT w.code, COUNT(s.id) as step_count
  FROM approval_workflows w
  LEFT JOIN approval_steps s ON s.workflow_id = w.id
  GROUP BY w.id, w.code
  HAVING COUNT(s.id) = 0;
  -- Should return 0 rows
  
  -- Verify exactly one final step per workflow
  SELECT w.code, COUNT(s.id) as final_count
  FROM approval_workflows w
  LEFT JOIN approval_steps s ON s.workflow_id = w.id AND s.is_final = true
  GROUP BY w.id, w.code
  HAVING COUNT(s.id) != 1;
  -- Should return 0 rows
  ```

### 3. Testing Environment

- [ ] **Deploy to Staging**
  ```bash
  # Deploy code to staging environment
  git checkout main
  git pull origin main
  npm run build
  # Deploy to staging server
  ```

- [ ] **Run Manual Tests** (see WORKFLOW_ADMIN_TEST_VALIDATION.md)
  - [ ] Test 1: View all workflows
  - [ ] Test 2: View workflow steps
  - [ ] Test 3: Add new step
  - [ ] Test 4: Edit existing step
  - [ ] Test 5: Delete step
  - [ ] Test 6-10: Validation tests
  - [ ] Test 16: Admin role required

- [ ] **Integration Tests**
  - [ ] Submit PR1 and verify approval flow
  - [ ] Submit PR2 and verify auto-approval
  - [ ] Submit PO and verify delivery creation

### 4. Documentation

- ✅ User guide created (WORKFLOW_ADMIN_GUIDE.md)
- ✅ Technical documentation created (WORKFLOW_ADMIN_TECHNICAL.md)
- ✅ Test validation document created (WORKFLOW_ADMIN_TEST_VALIDATION.md)
- ✅ Deployment checklist created (this file)
- [ ] **Update main README** with link to workflow admin docs

### 5. User Training

- [ ] **Prepare Training Materials**
  - [ ] Screenshots of workflow admin UI
  - [ ] Step-by-step guide for common tasks
  - [ ] Video walkthrough (optional)

- [ ] **Schedule Training Session**
  - [ ] Identify admin users who will use this feature
  - [ ] Schedule training date/time
  - [ ] Send calendar invites

- [ ] **Conduct Training**
  - [ ] Walk through user guide
  - [ ] Demonstrate adding/editing/deleting steps
  - [ ] Show special workflow warnings
  - [ ] Answer questions

---

## 🚀 Deployment Steps

### Step 1: Final Code Review

```bash
# Ensure you're on the main branch
git checkout main
git pull origin main

# Verify all files are present
ls types/workflow-admin.ts
ls lib/workflow-admin.ts
ls components/admin/WorkflowTable.tsx
ls components/admin/WorkflowStepEditor.tsx
ls components/admin/WorkflowStepForm.tsx
ls components/admin/WorkflowStepDeleteDialog.tsx
ls app/admin/workflows/page.tsx
```

### Step 2: Build and Test Locally

```bash
# Install dependencies (if needed)
npm install

# Run build
npm run build

# Start development server
npm run dev

# Test in browser
# Navigate to http://localhost:3000/admin/workflows
# Perform manual tests
```

### Step 3: Database Backup and Migration

```bash
# Using Supabase CLI
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql

# Or using Supabase Dashboard
# 1. Go to Database > Backups
# 2. Create manual backup
# 3. Download backup file
```

**Apply RLS Migration** (CRITICAL):
```bash
# Apply the admin workflow management RLS policies
supabase db push

# Or manually run the migration:
# supabase/migrations/20260521120000_add_admin_workflow_management_rls.sql
```

**Verify RLS Policies**:
```sql
-- Check that admin policies exist
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('approval_workflows', 'approval_steps')
ORDER BY tablename, policyname;

-- Should show 6 new policies:
-- - Admins can insert approval workflows
-- - Admins can update approval workflows
-- - Admins can delete approval workflows
-- - Admins can insert approval steps
-- - Admins can update approval steps
-- - Admins can delete approval steps
```

### Step 4: Deploy to Staging

```bash
# Commit and push changes
git add .
git commit -m "feat: Add workflow admin configuration feature"
git push origin main

# Deploy to staging (method depends on your hosting)
# Example for Vercel:
vercel --prod --scope=staging

# Example for Netlify:
netlify deploy --prod --dir=.next
```

### Step 5: Staging Validation

- [ ] Navigate to staging URL
- [ ] Login as admin user
- [ ] Access `/admin/workflows`
- [ ] Perform smoke tests:
  - [ ] View workflows
  - [ ] Select a workflow
  - [ ] View steps
  - [ ] Add a test step
  - [ ] Edit the test step
  - [ ] Delete the test step
- [ ] Check browser console for errors
- [ ] Check network tab for failed requests

### Step 6: Production Deployment

```bash
# Deploy to production
# Example for Vercel:
vercel --prod

# Example for Netlify:
netlify deploy --prod

# Example for custom server:
npm run build
# Copy .next folder to production server
# Restart Node.js process
```

### Step 7: Post-Deployment Verification

- [ ] Navigate to production URL
- [ ] Login as admin user
- [ ] Access `/admin/workflows`
- [ ] Verify workflows load correctly
- [ ] Check one workflow's steps
- [ ] **DO NOT make changes yet** (wait for monitoring period)

### Step 8: Monitoring

**First 24 Hours**:
- [ ] Monitor error logs
- [ ] Check audit_logs table for workflow changes
- [ ] Verify no impact on existing approval flows
- [ ] Monitor user feedback

**First Week**:
- [ ] Review audit logs daily
- [ ] Check for any reported issues
- [ ] Verify approval flows working correctly
- [ ] Collect user feedback

---

## 🔄 Rollback Procedure

If critical issues are discovered:

### Option 1: Hide the Feature (Quick)

```typescript
// In app/admin/workflows/page.tsx
// Add at the top of the component:
return (
  <AppShell title="Workflow Configuration">
    <div className="bg-pq-warning-100 p-6 rounded-lg">
      <p>This feature is temporarily unavailable for maintenance.</p>
    </div>
  </AppShell>
);
```

### Option 2: Restore Database (If Data Corrupted)

```bash
# Restore from backup
supabase db restore backup_YYYYMMDD_HHMMSS.sql

# Or manually restore tables
psql -h your-db-host -U postgres -d your-db < backup.sql
```

### Option 3: Revert Code (Full Rollback)

```bash
# Revert the commit
git revert <commit-hash>
git push origin main

# Redeploy
vercel --prod  # or your deployment method
```

---

## 📊 Success Metrics

### Week 1 Metrics

- [ ] Zero critical bugs reported
- [ ] All existing approval flows working
- [ ] At least 1 admin user successfully used the feature
- [ ] No database corruption or data loss

### Month 1 Metrics

- [ ] 3+ workflow modifications made successfully
- [ ] Zero rollbacks required
- [ ] Positive user feedback from admins
- [ ] Audit logs show proper usage

---

## 🎯 Post-Deployment Tasks

### Immediate (Day 1)

- [ ] Announce feature to admin users
- [ ] Share user guide link
- [ ] Set up monitoring alerts
- [ ] Be available for support

### Week 1

- [ ] Collect initial feedback
- [ ] Document any issues found
- [ ] Create FAQ based on questions
- [ ] Update documentation if needed

### Month 1

- [ ] Review audit logs for usage patterns
- [ ] Identify improvement opportunities
- [ ] Plan Phase 2 enhancements (drag-drop, etc.)
- [ ] Conduct user satisfaction survey

---

## 📞 Support Plan

### Support Contacts

- **Primary**: System Administrator
- **Secondary**: Development Team
- **Escalation**: Technical Lead

### Support Hours

- **Business Hours**: 9 AM - 5 PM (Monday-Friday)
- **After Hours**: Emergency contact only

### Issue Reporting

Users should report issues via:
1. Email: support@yourcompany.com
2. Internal ticketing system
3. Direct message to admin team

### Issue Priorities

**P0 - Critical** (Response: Immediate)
- System down
- Data corruption
- Security breach

**P1 - High** (Response: 4 hours)
- Feature not working
- Blocking workflow changes
- Approval flows broken

**P2 - Medium** (Response: 1 business day)
- UI issues
- Validation errors
- Documentation unclear

**P3 - Low** (Response: 1 week)
- Enhancement requests
- Cosmetic issues
- Nice-to-have features

---

## 🔐 Security Checklist

- ✅ Admin role required for access
- ✅ RLS policies enforced
- ✅ Audit logging enabled
- ✅ No sensitive data exposed in client
- ✅ Input validation on client and server
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (React escaping)
- [ ] **Security review completed**
- [ ] **Penetration testing (if required)**

---

## 📝 Deployment Sign-Off

### Pre-Deployment Approval

- [ ] **Developer**: Code complete and tested
  - Name: ________________
  - Date: ________________

- [ ] **Tech Lead**: Code reviewed and approved
  - Name: ________________
  - Date: ________________

- [ ] **QA**: Testing complete and passed
  - Name: ________________
  - Date: ________________

- [ ] **Product Owner**: Feature approved for release
  - Name: ________________
  - Date: ________________

### Post-Deployment Confirmation

- [ ] **DevOps**: Deployment successful
  - Name: ________________
  - Date: ________________
  - Environment: ________________

- [ ] **Developer**: Post-deployment verification complete
  - Name: ________________
  - Date: ________________

- [ ] **Support Team**: Notified and ready
  - Name: ________________
  - Date: ________________

---

## 🎉 Deployment Complete!

Once all checklist items are complete and sign-offs obtained, the Workflow Admin Configuration feature is ready for production use.

**Next Steps**:
1. Monitor for 24 hours
2. Collect user feedback
3. Plan Phase 2 enhancements
4. Celebrate the successful deployment! 🎊

---

**End of Deployment Checklist**
