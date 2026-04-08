# SplitKaro AI

SplitKaro AI is a collaborative expense-splitting app built for shared groups and direct one-to-one payments. It helps users track spending, manage settlements, analyze where money goes, and stay synced with realtime updates across dashboard and group views.

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

### Settlements

- settle balances inside a group
- settle direct one-to-one balances
- validate payer and receiver membership
- update balances after settlement

### Activity and history

- activity feed for group activity
- activity feed support for individual payment flows
- recent expense and settlement visibility inside groups
- dashboard spending summary with recent payments and category totals

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

### Settle a payment

1. Open a group.
2. Choose the payer and receiver.
3. Enter settlement amount.
4. Save settlement.
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
  lib/
prisma/
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
