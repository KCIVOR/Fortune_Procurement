# Seeded Demo Accounts

Source: `DEV_ACCOUNTS` list and `DEV_PASSWORD` constant in
[app/login/page.tsx](../app/login/page.tsx) (lines 20-38) — the "Dev Quick
Login" panel on the sign-in page. All accounts below share the same
password.

**Password (all accounts):** `Fortune2026!`

| Role (as labeled in Quick Login) | Email |
|---|---|
| Admin | admin@fortune.com |
| TSQA | ubeeeyk@gmail.com |
| Employee | employee@fortune.com |
| Planning | planning@fortune.com |
| Planning Head | planning.head@fortune.com |
| Procurement | procurement@fortune.com |
| Proc. Mgr | proc.manager@fortune.com |
| Warehouse | warehouse@fortune.com |
| Director | director@fortune.com |
| Ops Manager | operations.manager@fortune.com |
| Dept. Head | dept.head@fortune.com |
| Supervisor | supervisor@fortune.com |
| Finance Dir. | finance.director@fortune.com |
| Supplier 1 | supplier@fortune.com |
| Supplier 2 | supplier2@fortune.com |
| Supplier 3 | supplier3@fortune.com |

Note: the "Role" column above is the Quick Login button's display label, not
necessarily the literal `roles.name` value in the database (e.g. "Planning"
and "Planning Head" are both position-level distinctions under the
`employee`/`approver` roles — see the app's `/admin/users` page for each
account's actual role/position/department).
