# SplitKaro AI

SplitKaro AI is a collaborative expense-splitting app built for groups and direct one-to-one payments. It helps users track shared spending, manage settlements, and stay synced with realtime updates across dashboard and group views.

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
- edit expenses
- delete expenses
- validate that payer and split users belong to the group

### Individual payments

- add direct friend payments from the dashboard
- store these as expenses with `groupId: null`
- show direct balances in the People/Friends style overview
- refresh related dashboards in realtime when a direct payment is added

### Settlements

- settle balances inside a group
- validate payer and receiver membership
- update balances after settlement

### Activity and history

- activity feed for group activity
- activity feed support for individual payment flows
- recent expense and settlement visibility inside groups

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

## Feature Highlights Added In This Workspace

These are the bigger product improvements added on top of the basic expense-sharing flow.

- Redis-backed realtime sync using SSE
- individual payment flow from dashboard
- user-level and group-level realtime refresh
- group admin promotion and role management
- leave-group flow with balance checks
- remove-member flow with balance checks
- editable profile name on Me page
- About page entry flow from welcome page
- responsive mobile cleanup for dashboard, group settings, and profile screens
- icon-based member controls for tighter mobile layouts
- stronger API validation for group membership in expenses and settlements

## Main User Flows

### Create and manage a group

1. User creates a group.
2. The creator becomes an admin.
3. Admin adds members.
4. Admin can promote other members to admin.
5. Group members add expenses and settlements.

### Add a shared expense

1. Open the group page.
2. Add amount and description.
3. Choose payer.
4. Pick equal or custom split mode.
5. Save the expense.
6. Group balances and dashboard summaries update.

### Add an individual payment

1. Open dashboard.
2. Click `Add Individual`.
3. Pick a friend or search by email.
4. Add amount and description.
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
- Group membership and settlement rules are validated server-side.
