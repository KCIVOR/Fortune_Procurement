# Environment Setup Guide

## Overview

This project uses environment-specific configuration to separate production and staging environments.

## Environment Files

### `.env` (Production - Tracked in Git)
- Contains production Supabase credentials
- Used by default when no `.env.local` exists
- **Branch**: `main`
- **Project**: Fortune Procurement (qvxrvnsjlycdgvhwgtkj)

### `.env.local` (Staging - NOT Tracked in Git)
- Contains staging Supabase credentials
- Overrides `.env` when present
- **Branch**: `develop`
- **Project**: Your new staging project

### `.env.staging.example` (Template)
- Template file showing what staging config should look like
- Copy this to `.env.local` and fill in your staging credentials

## Workflow

### Working on Production (main branch)
```bash
git checkout main
# Delete .env.local if it exists
rm .env.local  # or del .env.local on Windows
npm run dev
```

### Working on Staging (develop branch)
```bash
git checkout develop

# Create .env.local from template
cp .env.staging.example .env.local  # or copy on Windows

# Edit .env.local with your staging Supabase credentials
# Then start the dev server
npm run dev
```

## Next.js Environment Priority

Next.js loads environment variables in this order (highest priority first):
1. `.env.local` (highest priority - use for staging)
2. `.env.development` / `.env.production` / `.env.test`
3. `.env` (lowest priority - production defaults)

## Safety Tips

✅ **DO:**
- Keep `.env.local` for local staging work
- Use `.env` for production defaults
- Commit `.env.staging.example` as a template
- Document which project each environment uses

❌ **DON'T:**
- Commit `.env.local` to Git (it's already in .gitignore)
- Mix production and staging credentials
- Share service role keys publicly

## Getting Your Staging Credentials

After creating your staging Supabase project:

1. Go to your Supabase dashboard
2. Select your staging project
3. Go to Settings → API
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

## Database Migrations

### For Staging
```bash
# Make sure .env.local points to staging
# Run migrations against staging database
npx supabase db push
```

### For Production
```bash
# Remove .env.local or rename it temporarily
# Migrations will use .env (production)
npx supabase db push
```

## Verifying Your Environment

Check which Supabase project you're connected to:
```javascript
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
```

Or check in your browser console after starting the app:
```javascript
// In browser console
localStorage.getItem('supabase.auth.token')
```
