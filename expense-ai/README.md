# SplitKaro AI

SplitKaro AI is a collaborative expense-splitting app built for shared groups and direct one-to-one payments. It helps users track spending, manage settlements, analyze where money goes, and stay synced with realtime updates across dashboard and group views.

## Current Direction

The codebase is moving toward a cleaner finance-domain split:

- `Personal Finance`
- `Group Finance`

The current stable app still supports the legacy direct-payment flow, but the refactor direction is to separate domain logic, APIs, analytics, and dashboard experiences so personal tracking no longer depends on group-style modeling.

## What The App Supports

### Authentication and access

- sign up with email and password
- log in with credentials
- log in with Google
- session-based protected dashboard routes
- editable user name from the Me page

### Groups

- create a new group
- rename a group
- archive a group
- delete a group
- view group details and balances
- see active members and roles
- toggle simplified debt view for a group
- keep a virtual `Individual Payments` group for solo transactions

### Group member management

- creator is added as `ADMIN` automatically
- admins can add members by email
- admins can promote members to admin
- admins can remove members
- members can leave a group
- last admin / unsettled-balance edge cases are guarded
- remove/leave is only allowed when balances for that member are settled

### Expenses

- add group expenses
- choose who paid
- split equally
- split with custom amounts
- parse natural-language payment input
- support voice-to-text expense drafting
- edit expenses
- delete expenses
- categorize expenses
- infer categories from descriptions when helpful
- validate that payer and split users belong to the group

### Individual payments

- add direct friend payments from the dashboard
- store these as expenses with `groupId: null`
- categorize direct payments too
- show direct balances in the People/Friends style overview
- show solo transactions inside a virtual individual-payments group
- refresh related dashboards in realtime when a direct payment is added

### Personal transactions

- add personal expenses from the Me page
- each transaction records amount, description, category, and date
- date field pre-fills to today in local time (timezone-safe, avoids UTC off-by-one in IST)
- supports editing and deleting personal transactions

### Settlements

- settle balances inside a group
- settle direct one-to-one balances
- validate payer and receiver membership
- update balances after settlement

### UPI Payments

- save a personal UPI ID from the Me page
- group members can see each other's UPI IDs
- tapping Settle on a debt you owe shows a UPI pay bottom sheet
- sheet displays the receiver's UPI ID prominently with a one-tap copy button
- a step guide instructs: copy the UPI ID, then open your UPI app to pay
- on iOS: three app buttons (PhonePe, Google Pay, Paytm) open each app directly using app-specific bare launch schemes
- on Android: a single "Open UPI App" button triggers the system app chooser via the standard `upi://pay` scheme
- pre-filling payment params is intentionally skipped — PWA context does not reliably hand off UPI params to any app on either platform
- after returning from the payment app, a confirmation modal appears automatically
- user confirms or cancels; confirmed payments are recorded as settlements immediately
- confetti animation fires on confirmed settlement
- if the receiver has no UPI ID saved, falls back to the manual settlement modal

### Activity and history

- activity feed for group activity
- activity feed support for individual payment flows
- recent expense and settlement visibility inside groups
- dashboard spending summary with recent payments and category totals

### Backend safeguards

- case-insensitive user lookup for session-linked APIs
- server-side validation for group payer and split membership
- server-side validation for group settlement participants
- Prisma-backed aggregation for spending summary data

### Realtime updates

- dashboard listens for updates
- group pages listen for updates
- group-level events refresh relevant group screens
- user-level events refresh relevant user/dashboard screens
- Redis-backed SSE fanout for hosted environments

### Responsive UI

- mobile-friendly dashboard
- mobile-friendly group page
- compact member-management controls in group settings
- custom in-app modals instead of browser alerts/confirms
- icon-first action controls to reduce crowding on mobile
- bottom navigation with correct active tab highlighting on all pages

### PWA

- installable on Android, iOS, and desktop
- Web App Manifest with name, colors, icons, display mode
- service worker with cache-first for static assets and network-first for pages
- offline fallback page served only when the device is genuinely offline
- iOS home screen support with `apple-touch-icon` and 12 splash screen sizes
- theme color and viewport fit set for status bar integration
- PWA icons at 192px, 512px, and 180px generated from the SVG logo
- service worker only registers in production to avoid LAN-IP dev issues

## Feature Highlights Added In This Workspace

These are the bigger product improvements added on top of the basic expense-sharing flow.

- Redis-backed realtime sync using SSE
- individual payment flow from dashboard
- user-level and group-level realtime refresh
- group admin promotion and role management
- group simplify-expenses toggle
- leave-group flow with balance checks
- remove-member flow with balance checks
- editable profile name on Me page
- UPI ID field on Me page with format validation
- Member Since display on Me page
- UPI Settle & Confirm flow with platform-aware pay sheet, return detection, and confetti
- platform-aware UPI pay sheet: iOS shows 3 app buttons, Android shows single app chooser button
- UPI ID copy-paste flow replacing unreliable pre-filled deep links (PWA context limitation)
- payment return detection using localStorage + visibilitychange event + on-mount check for PWA reload case
- stale pending payment cleanup (entries older than 10 minutes are auto-discarded)
- canvas-based confetti on confirmed settlement (no external package)
- personal transaction date field with timezone-safe local date pre-fill
- settlement payer ID normalization to fix JWT vs database ID mismatch on settlement creation
- About page entry flow from welcome page
- dedicated About page for multiple developers
- responsive mobile cleanup for dashboard, group settings, and profile screens
- icon-based member controls for tighter mobile layouts
- voice-to-text expense drafting
- natural-language parsing for expenses
- payment categories with category-aware icons
- dashboard spending summary tab
- stronger API validation for group membership in expenses and settlements
- case-insensitive user/email lookup improvements for hosted environments
- full PWA with manifest, service worker, offline page, and iOS splash screens
- bottom navigation fixed to show correct active tab on all dashboard pages
- removed redundant per-page initials avatars from dashboard, personal, and groups pages

## Main User Flows

### Create and manage a group

1. User creates a group.
2. The creator becomes an admin.
3. Admin adds members.
4. Admin can promote other members to admin.
5. Group members add expenses and settlements.

### Add a shared expense

1. Open the group page.
2. Add amount and description, or use voice/natural-language input.
3. Choose payer.
4. Pick equal or custom split mode.
5. Choose or confirm the category.
6. Save the expense.
7. Group balances and dashboard summaries update.

### Add an individual payment

1. Open dashboard.
2. Click `Add Individual`.
3. Pick a friend or search by email.
4. Add amount, description, and category.
5. Save.
6. Both users get refreshed data through realtime updates.

### Settle via UPI

1. Open a group.
2. Tap the Settle button on a debt balance you owe.
3. A bottom sheet shows the receiver's UPI ID with a copy button.
4. A step guide on the sheet reads: copy the UPI ID, then open your app.
5. Tap Copy to copy the UPI ID to the clipboard.
6. On iOS: tap one of the three app buttons (PhonePe, Google Pay, Paytm) to open that specific app.
7. On Android: tap Open UPI App to open the system app chooser.
8. In the UPI app, paste the copied UPI ID and enter the amount to complete the payment.
9. Return to SplitKaro — a confirmation modal appears automatically.
10. Tap Yes — the settlement is recorded and confetti fires.
11. Tap No — the payment is not recorded; the user can try again.

### Settle manually

1. Open a group.
2. Tap Settle on a debt someone owes you, or when receiver has no UPI ID.
3. A modal shows the suggested amount.
4. Confirm to record the settlement.
5. Debt calculations refresh for all related users.

### Leave or remove a member

1. Open group settings.
2. Admin can remove a member, or a member can leave.
3. Backend checks outstanding balances first.
4. If fully settled, the membership change is applied.
5. Related screens refresh in realtime.

### Review spending by category

1. Open dashboard.
2. Go to the `Spend` tab.
3. See total paid, group spend, and individual spend.
4. Review category-wise totals and recent payments.
5. Use this summary to understand where most money is being spent.

## Project Structure

```text
src/
  app/
    (auth)/
    (dashboard)/
    api/
  components/
    providers/
    shared/
    ui/
  hooks/
  lib/
  types/
prisma/
public/
  icons/
  sw.js
  offline.html
scripts/
```

## Important Pages

- `/welcome`
- `/login`
- `/signup`
- `/dashboard`
- `/groups/[groupId]`
- `/create-group`
- `/me`
- `/about`

## Important API Areas

- `/api/auth/[...nextauth]`
- `/api/auth/signup`
- `/api/groups`
- `/api/groups/[groupId]`
- `/api/groups/[groupId]/parse`
- `/api/groups/[groupId]/members`
- `/api/groups/[groupId]/members/[memberId]`
- `/api/groups/[groupId]/leave`
- `/api/expenses`
- `/api/expenses/[expenseId]`
- `/api/settlements`
- `/api/activities`
- `/api/events`
- `/api/spending-summary`
- `/api/me`
- `/api/friends`
- `/api/users/find`

## Refactor Roadmap

This is the backend/frontend separation direction for the next architecture pass.

### Personal finance target

- dedicated personal transactions
- personal-only summaries and monthly analytics
- separate dashboard route under `/dashboard/personal`
- no split logic for personal entries

### Group finance target

- dedicated group expense endpoints
- dedicated group settlement endpoints
- group-only validation for membership, splits, and balances
- separate dashboard route under `/dashboard/groups`

### Unified overview target

- combined dashboard overview remains available
- total personal spending
- total group spending
- recent activity in one place
- internal logic stays separated even if overview UI is combined

### Migration approach

- keep current UI stable while backend paths are separated
- add new domain-first APIs before removing legacy mixed routes
- move analytics next
- split dashboard routes after backend contracts are stable

## Environment Variables

Set these before running the app.

```env
DATABASE_URL=
DIRECT_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
REDIS_URL=
```

## Local Development

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npx prisma generate
```

Run the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Generate PWA icons and splash screens:

```bash
npm run generate-icons
```

## Learning Docs

If you want to understand the stack and concepts in depth, read:

- [TECH_STACK.md](/D:/SplitKaro%20AI/expense-ai/TECH_STACK.md)

## Notes

- The database is the source of truth for balances and activity.
- Realtime updates are delivered through Redis-backed Server-Sent Events.
- Individual payments are modeled as expenses where `groupId` is `null`.
- Group debt display can be switched between original pairwise balances and simplified transfers.
- Payment categories are stored in the database for both group and individual expenses.
- Voice and natural-language inputs are draft helpers; users can still review and edit before saving.
- Group membership and settlement rules are validated server-side.
- UPI payments use a copy-paste flow because `upi://` pre-fill params are unreliable from a PWA web context on both iOS and Android.
- On iOS, app-specific bare launch schemes (`phonepe://`, `tez://`, `paytmmp://`) open the correct app directly since iOS has no system app chooser for custom URL schemes.
- On Android, `upi://pay` (no params) opens the system app chooser; the user pastes the copied UPI ID manually.
- The service worker is disabled in development to prevent offline-page false positives when testing on phones via LAN IP.
- The next structural improvement is clean domain separation between personal finance and group finance.
