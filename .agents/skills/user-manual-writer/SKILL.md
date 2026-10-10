---
name: user-manual-writer
description: Use when the user requests a user manual, user guide, help documentation, onboarding guide, or other end-user documentation for software whose codebase is available for inspection.
---

# User Manual Writer

Create a trustworthy, plain-language end-user manual as a consistently formatted
`.docx` file, grounded in the application's actual code.

## Source-of-truth rule

Audit the codebase before drafting. Code is the source of truth; README files,
existing documentation, comments, and labels are supporting context only. Never
describe behavior based on convention or what a feature appears to imply.

For each claim, know the file, component, route, handler, validation rule, or
conditional rendering that supports it. If behavior cannot be confirmed, do not
guess and do not silently omit it. Put it in `needs_clarification` with a reason
that a non-technical reviewer can act on.

## Required workflow

1. Inventory what an end user can see or do: screens and routes, buttons and
   links, forms and validation, multi-step flows, and role/permission differences.
2. Trace every documented feature to code. Investigate ambiguous handlers,
   dead code, feature flags, mismatched labels, and permission conditions.
3. Write in plain language for a non-technical user. Avoid terms such as API,
   backend, database, and boolean. Use short active sentences.
4. Give every feature the same structure: **What it's for**, **Where to find it**,
   **Steps**, and optional **Tips and things to watch out for**. Steps are numbered,
   imperative, and include observable results when the code makes them knowable.
5. Call `load_workspace_dependencies` before working with the Word artifact when
   that tool is available. Create `content.json` using the schema below, then run:

   ```bash
   python3 scripts/build_manual.py content.json output.docx
   ```

   Use the bundled `scripts/build_manual.py`; do not hand-build one-off formatting.
6. Before delivery, compare the complete audit inventory with the document body
   and the clarification appendix. Nothing found during the audit may disappear.
   Report the number of documented features and clarification items.

## Content schema

```json
{
  "app_name": "Acme Time Tracker",
  "manual_title": "User Manual",
  "version": "1.0",
  "date": "September 2026",
  "introduction": "One or two short paragraphs separated by a blank line.",
  "features": [
    {
      "title": "Logging Your Hours",
      "purpose": "What this lets the user accomplish.",
      "location": "Where the user finds it on screen.",
      "steps": ["Click New Entry.", "Enter the hours.", "Click Save."],
      "tips": ["Verified constraint or permission requirement."]
    }
  ],
  "needs_clarification": [
    {
      "item": "Unclear feature or control",
      "reason": "What the code shows and what must be confirmed."
    }
  ]
}
```

Keep `tips` and `needs_clarification` as empty lists when there is nothing to
report. Do not add guessed fields or behavior. The build script supplies the
cover page, table of contents field, headings, page numbers, and fixed formatting.

## Common mistakes to avoid

- Treating a route, button label, or README description as proof of behavior.
- Omitting an unclear or unfinished feature instead of flagging it.
- Writing technical implementation details instead of user actions and visible results.
- Claiming a confirmation, redirect, limit, or permission rule that was not found in code.
- Delivering a manual without checking every audited item against the body or appendix.
