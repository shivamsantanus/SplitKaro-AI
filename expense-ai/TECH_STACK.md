# SplitKaro AI Tech Stack Guide

This document explains the technologies, patterns, and concepts used in this workspace so you can study them one by one.

## Core Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Lucide React

### Backend

- Next.js Route Handlers
- NextAuth.js
- Prisma ORM
- PostgreSQL
- Redis
- Server-Sent Events (SSE)
- Node.js runtime for streaming endpoints

### Tooling

- ESLint
- PostCSS
- Autoprefixer
- Prisma Client generation

## Technologies Explained

### Next.js

Next.js is the full-stack framework for this project.

Why it is used:

- page routing
- API endpoints in the same app
- layouts and shared providers
- production build optimization
- App Router structure

Files to study:

- `src/app/layout.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/api/groups/route.ts`

Concepts:

- App Router
- `page.tsx`
- `route.ts`
- layouts
- server/client boundaries

### React

React powers the UI and interaction layer.

Concepts used here:

- `useState`
- `useEffect`
- `useCallback`
- controlled inputs
- conditional rendering
- modal-driven UI

Examples:

- dashboard tabs
- expense modal state
- group settings modal
- realtime re-fetch logic

### TypeScript

TypeScript improves safety and maintainability.

Concepts to learn:

- object types
- unions
- optionals
- type inference
- custom type aliases

Examples:

- API response shaping
- typed summary objects
- typed component state

### Tailwind CSS

Tailwind is the styling system used across the UI.

Concepts to learn:

- utility-first styling
- responsive prefixes like `sm:` and `md:`
- spacing, flex, grid, typography
- state styling like `hover:` and `disabled:`

Examples:

- mobile responsive layouts
- cards and modals
- icon-button controls in group settings

### Lucide React

Lucide provides the icon set.

Examples in this app:

- `Settings`
- `Plus`
- `ShieldCheck`
- `Trash2`
- `UserMinus`
- `Activity`

### NextAuth.js

NextAuth handles login and session state.

Used here for:

- credentials auth
- Google auth
- JWT-based sessions

Key file:

- `src/lib/auth.ts`

Concepts:

- providers
- callbacks
- session strategy
- exposing user id in the session

### bcryptjs

Used for secure password verification.

Concepts:

- hashing
- compare
- never storing raw passwords

### Prisma ORM

Prisma is the typed database layer.

Key files:

- `prisma/schema.prisma`
- `src/lib/prisma.ts`

Concepts:

- models
- relations
- indexes
- transactions
- generated client
- singleton client pattern

### PostgreSQL

PostgreSQL stores the relational data.

Why it fits:

- users, groups, expenses, splits, settlements are relational
- supports indexes and structured queries well

Important relation examples:

- many-to-many via `GroupMember`
- one-to-many from `Group` to `Expense`
- one-to-many from `Expense` to `ExpenseSplit`

### Redis

Redis is used for realtime fanout.

Key file:

- `src/lib/redis.ts`

Concepts:

- pub/sub
- channels
- duplicate subscriber clients
- reconnect strategy

Channel patterns:

- `user:<userId>`
- `group:<groupId>`

### Server-Sent Events (SSE)

SSE is how the server pushes update notifications to clients.

Key files:

- `src/lib/realtime.ts`
- `src/app/api/events/route.ts`

Concepts:

- `text/event-stream`
- long-lived connection
- heartbeat/ping events
- browser `EventSource`
- server publishes, client re-fetches

Current flow:

1. Client opens `/api/events`.
2. Server authenticates the user.
3. Server subscribes to that user’s channels.
4. Writes publish Redis events.
5. SSE forwards `update` events.
6. Frontend fetches fresh dashboard/group/activity data.

## Core Product Concepts

### Authentication vs Authorization

- authentication = who the user is
- authorization = what the user is allowed to do

Examples:

- only logged-in users can access dashboard routes
- only group members can access a group
- only admins can promote/remove members

### Group expense splitting

The main business logic is based on:

- who paid
- how the amount is split
- who still owes money
- how settlements reduce debt

Split modes:

- equal
- custom

### Individual payments

This app supports solo/direct payments too.

How it is modeled:

- save expense with `groupId: null`
- keep splits pointing to the friend involved
- include these in dashboard balances and activity

### Realtime synchronization

Realtime does not directly mutate all UI state blindly.

Instead:

1. write to database
2. publish Redis event
3. receive SSE event on client
4. refetch fresh data

This keeps the database as source of truth.

### Transactions

Transactions are used when multiple writes must succeed together.

Example:

- create group
- add creator as admin member

### Validation

Important server-side checks in this project include:

- session exists
- user exists
- group membership is valid
- payer belongs to group
- split users belong to group
- settlement payer/receiver belong to group
- member removal or leaving only when balances are settled

## Database Models

### User

- account identity
- email/login info
- relations to memberships, expenses, settlements, activities

### Group

- shared expense container
- archived/active state
- creator relationship

### GroupMember

- join model between users and groups
- stores role like `ADMIN` or `MEMBER`

### Expense

- main payment record
- can belong to a group or be an individual payment with `groupId: null`

### ExpenseSplit

- describes who owes what portion of an expense

### Settlement

- records repayment between users

### Activity

- feeds dashboard/group activity logs
- flexible `metadata` JSON field

## Important Files To Learn From

### App shell

- `src/app/layout.tsx`

### Auth

- `src/lib/auth.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/auth/signup/route.ts`

### Database

- `prisma/schema.prisma`
- `src/lib/prisma.ts`

### Realtime

- `src/lib/redis.ts`
- `src/lib/realtime.ts`
- `src/app/api/events/route.ts`

### Groups and members

- `src/app/api/groups/route.ts`
- `src/app/api/groups/[groupId]/route.ts`
- `src/app/api/groups/[groupId]/members/route.ts`
- `src/app/api/groups/[groupId]/members/[memberId]/route.ts`
- `src/app/api/groups/[groupId]/leave/route.ts`

### Expenses and settlements

- `src/app/api/expenses/route.ts`
- `src/app/api/expenses/[expenseId]/route.ts`
- `src/app/api/settlements/route.ts`

### Dashboard and UI

- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/groups/[groupId]/page.tsx`
- `src/app/(dashboard)/me/page.tsx`
- `src/components/ui/SoloExpenseModal.tsx`

## Environment Variables

```env
DATABASE_URL=
DIRECT_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
REDIS_URL=
```

## Suggested Learning Order

1. Learn React state and component basics.
2. Learn Next.js App Router structure.
3. Learn Tailwind utility styling.
4. Learn TypeScript object typing.
5. Learn Prisma schema and relations.
6. Learn NextAuth login/session flow.
7. Learn route handlers and server validation.
8. Learn split/settlement business logic.
9. Learn Redis pub/sub and SSE realtime flow.
10. Learn performance and scaling tradeoffs.
