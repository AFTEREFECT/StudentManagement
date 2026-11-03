# Local administration and teacher platform access

The local administration program opens without asking for an administrator
password or local access code. This applies to `/` and `/attendance`; existing
student, settings, and SQLite data are left intact. License and subscription
checks remain unchanged.

The teacher platform remains separate and keeps its server-side authentication.
The administration sidebar does not link to `/teacher` or the teacher PWA.
Opening `/teacher` directly still presents the teacher-only cloud portal and
requires a teacher account; it does not display the local administration screens.
The `/attendance-cloud` route remains the separate cloud attendance management
portal and also retains its server authentication.

Administrators can open the teacher-submitted attendance and review page from
the administration sidebar under "الحضور والغياب" → "غيابات الأساتذة (المنصة)".
It opens the existing cloud administration portal inside the application and
requires the institution's cloud administrator account. It does not expose
administrator access to teacher accounts or weaken cloud authorization.
Returning from the cloud portal opens local absence management instead of
reopening the cloud login form.
The cloud administrator signs in once per browser profile. Supabase persists
and refreshes the session on that device until the administrator signs out or
clears browser data. The local program's passwordless access does not sign in to
the cloud platform.

Removing the local password gate means anyone with access to the open
administration program or its device can use the local data and management
features. Protect the computer and database backups with operating-system
accounts and permissions. This does not disable licensing, encrypt the local
database, or change teacher-platform authentication.

Offline verification: `npm run test:local-admin-auth`.
