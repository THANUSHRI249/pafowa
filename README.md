# PAFOWA · Pargavi Apartments Foundation Committee Association

A lightweight, mobile-first maintenance management app for an apartment association.
Every account — resident or committee — signs in with its own phone number and a
password issued by the committee. Residents pay monthly maintenance and download
receipts. The treasurer records and confirms payments, tracks expenses, manages
apartments and publishes notices. The president and secretary have read-only oversight
and share security alarms with the treasurer.

Built with **React 19 + Vite**, **Tailwind CSS v4**, **Lucide icons**,
**Supabase** (PostgreSQL, Auth, Storage) and **jsPDF**.

---

## What is included

**Resident**
- Phone number + password issued by the treasurer, at every new browser session
- Dashboard with apartment, current month status, amount due, last payment and notices
- Submit a payment (Cash or Bank / UPI) with duplicate protection
- Payment history with month / status / method filters
- Download PDF receipts
- Profile with name and phone

**Committee (treasurer, president, secretary)**
- Phone number + password, the same login as residents, at every new session
- Treasurer: full access to collections, expenses, apartments, notices and security
- President and secretary: read-only oversight of the same records
- Security page: new-device alarms, known devices, officer activity, instant lockdown
- Dashboard: total collection, cash, bank, pending, collection rate, expenses

**Apartment structure is configurable** — blocks, unit numbers, amounts and combined
units (e.g. `A2 + T2`) are all managed from the Apartments page. Nothing is hardcoded.

The app ships with **no sample data**. A new installation starts empty and the treasurer
adds the real blocks, apartments and amounts.

---

## Security model

- **Residents** sign in with a phone number and a password set by the treasurer. The
  password is required again for every new browser session. Residents can only read and
  write records for the apartment linked to their account.
- **Officers** sign in with their own phone number and a password issued by the committee.
  It is the same form as residents. The password is required again for every new browser
  session.
- **New-device alarm.** Every officer sign-in from a device the association has not seen
  raises a warning alert for all three officers. The alert appears as a red banner and on
  the Security page until a committee member acknowledges it.
- **Instant lockdown.** Any officer can lock an account from the Security page. Locking
  raises a critical alert, blocks every RLS helper, and shows the locked user a dedicated
  screen. Only the treasurer can unlock.
- **Row Level Security** on every table. No DELETE grants exist on financial tables.
  Confirmed payments are immutable; expenses are voided with a reason and stay visible.
- **Receipt numbers** (`PAFOWA-YYYY-NNNN`) are issued inside a database function, not in
  the browser.
- **Private Storage** for vouchers and archived receipts. Only the treasurer can read or
  upload them.
- **No service-role key in the frontend.** Only the anon public key is used; every
  privileged operation is enforced inside the database.

`supabase/schema.sql` is the source of truth for all of this. Review it before applying.

---

## Local setup

### 1. Create a Supabase project

Create a free project at [supabase.com](https://supabase.com), then copy the **Project
URL** and the **anon public** key from *Project Settings → API*.

```bash
npm install
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

### 2. Create the database

Open the Supabase **SQL Editor** and run `supabase/schema.sql` once. It creates the
tables, indexes, triggers, Row Level Security policies, security RPCs and the private
`vouchers` / `receipts` Storage buckets.

There is deliberately **no seed file**. The database starts empty.

### 3. Configure authentication

In *Authentication → Providers*:

- **Email** — enable it. Supabase uses the email provider for password sign-ins; the app
  maps every phone number to a reserved address, so no real email is involved.
- **Phone** — not needed. Every login uses the email provider with a reserved address and
  a committee-issued password, so no SMS provider, credit or test-OTP setup is required
  anywhere in this app.

> Every login address is `<phone digits>@residents.pafowa.in`, a reserved domain that is
> never emailed. The app maps the phone number to that address automatically.

Optional hardening: turn **Allow new users to sign up** off under
*Authentication → Sign In / Up*. The app has no sign-up screen and all logins are written
by database functions, so switching sign-ups off blocks strangers without affecting
anyone.

### 4. Create the first treasurer login

After the schema is applied, create the treasurer's login in the SQL Editor:

```sql
select public.bootstrap_officer_login(
  'Treasurer Name',
  '+919840000000',
  'ChooseAStrongPassword',
  'treasurer'
);
```

The function creates the phone login with that role, or resets the password if the phone
already has a login. It is deliberately not callable from the app, so only someone with
access to the SQL Editor can run it.

Hand the treasurer their phone number and password. Once signed in, the treasurer adds
everyone else from the app:

1. Open **Security → Committee accounts → Add**.
2. Enter the officer's name, their own phone number, a role (president or secretary) and a
   password (the app suggests a strong one).
3. Hand over the phone number and password. They sign in on the same screen as residents
   and land on the committee dashboard.

To reset any officer password, open **Security → Committee accounts → Reset password**.
The old password stops working immediately.

### 5. Onboard residents

Residents do **not** sign themselves up. The treasurer creates each login:

1. Open **Apartments** and edit the flat.
2. Under **Resident app login**, choose **Create login**.
3. Enter the resident's name, their phone number and a password (the app suggests a
   strong one). The apartment is linked automatically.
4. Hand the phone number and password to the resident. They sign in and only see their
   own unit and payments.

Lost password? **Apartments → Edit → Reset password** sets a new one immediately; the old
password stops working.

Because a resident's phone number is their login, it is read-only on the Profile page.
Ask the treasurer if a number must change.

> **Fallback:** resident logins are written by a database function in
> `supabase/schema.sql`. If your Supabase project refuses the write (a permissions error
> appears), create the account manually in *Authentication → Users → Add user* using the
> resident's phone digits + `@residents.pafowa.in` (for example
> `919840067890@residents.pafowa.in`), the chosen password, and **Auto Confirm User**
> ticked. Sign-in works the same way.

### 6. Run

```bash
npm run dev       # local development
npm run build     # production bundle in dist/
npm run preview   # preview the built app
```

---

## Deploy for free

The repository includes `netlify.toml` with the SPA rewrite rule, so any static host that
supports redirects can serve the app. Netlify's free tier works well:

1. Push this repository to GitHub.
2. In Netlify, choose **Add new site → Import an existing project** and select the repo.
3. Build command: `npm run build`; publish directory: `dist`.
4. Add environment variables under **Site configuration → Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. After changing environment variables, trigger a new deploy so Vite bakes them
   into the bundle.

Alternatively, deploy from the CLI:

```bash
npx netlify-cli login
npx netlify-cli init
npx netlify-cli deploy --prod --dir=dist
```

The anon key is safe to ship in the browser; RLS enforces access. Never add the
service-role key to Netlify or to this repository.

> **No SMS costs:** resident logins are phone + password created by the treasurer, so the
> app never sends a text message and needs no paid provider.

---

## Project structure

```
src/
  components/
    auth/            locked-account screen
    layout/          app shell, role-based bottom navigation
    security/        in-app alarm banner
    ui/              Button, Card, Input, Badge, Modal, StatCard, EmptyState...
    PaymentFields.jsx, PaymentDetailModal.jsx, AnnouncementCard.jsx
  context/           AuthContext, ToastContext
  hooks/             useAsyncData, useSecurityOverview
  lib/
    config.js        app name, roles, expense/occupancy categories
    data.js          the Supabase repository
    supabaseRepo.js  Supabase adapter (queries + RPCs + Storage + Auth)
    billing.js       billing units, combined units, summaries, status precedence
    security.js      session gates, device fingerprint, security event bus
    pdf.js           receipt PDF (jsPDF, Indian amount in words)
    utils.js         money, dates, month keys, formatting
  pages/
    Login.jsx
    resident/        Home, Maintenance
    shared/          History, Notices, Profile
    admin/           Dashboard, Collections, Expenses, Apartments, Security, More
supabase/
  schema.sql         tables, RLS, triggers, RPCs, storage policies
```

Once configured, all screens talk to a single Supabase repository. Dashboards, totals and
statuses are derived from the loaded records (`billing.js`) — there are no hardcoded
figures.

### Billing units

A billing unit is either one apartment or one active combined unit. Combined members are
removed from the individual list so maintenance can never be charged twice. Payment status
precedence is **confirmed → pending → rejected → unpaid**.

---

## Manual test checklist

1. Sign in as treasurer with the phone number and password you issued, and land on the
   dashboard. Add a president and a secretary from **Security → Committee accounts → Add**.
2. Add blocks and apartments; set maintenance amounts; link a resident account.
3. Record a cash payment, confirm it, open the receipt PDF.
4. Reject a pending payment with a reason; it stays in history.
5. Combine two apartments (one status, one receipt), then separate them.
6. Add an expense with a voucher; check month and category totals.
7. Publish a water/electrical/general notice.
8. Create a resident login from **Apartments → Edit**; sign in as that resident with the
   phone number and password, submit a bank payment with a UTR; the treasurer confirms
   it; the resident downloads the receipt.
9. Clear only `sessionStorage` and reload: every account must re-enter its phone number
   and password.
10. Sign in as president or secretary from a new device: a new-device alarm appears for
    all three officers; verify no record/confirm/void controls are shown.
11. Lock an officer account, confirm the critical alert, then sign in as that officer and
    confirm the locked screen. Unlock as treasurer.
12. Resident cannot open `/admin/*` routes or see another apartment's payments.
13. Test on a phone-sized viewport: bottom navigation, sheet modals, large touch targets.

---

## Notes and limitations

- The app assumes INR and the Indian financial year for receipt numbering.
- Amounts are stored as `numeric(12,2)`; PDF uses "Rs." because jsPDF's Helvetica font
  has no rupee glyph.
- PDF generation and receipt archiving happen in the browser. Archiving to Storage is
  best-effort; a failed archive does not invalidate a confirmed receipt.
- There is no email/SMS notification service; security alarms and announcements appear in
  the app.
- The committee issues and resets every password — the treasurer adds officers from the
  Security page and residents from the Apartments page. Only the first treasurer login is
  created in the SQL editor. There is no self-service password reset, which keeps the
  association free of SMS or email costs.
- Browsers only. No native app is included.
