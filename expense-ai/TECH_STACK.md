# SplitKaro AI Tech Stack Guide

This document explains the technologies, patterns, and concepts used in this workspace so you can study them one by one.

## Architecture Direction

The project is evolving toward two cleaner finance domains:

- `Personal Finance`
- `Group Finance`

The current stable codebase still contains some mixed direct-payment logic, but the architectural direction is to separate:

- storage models
- API routes
- validation rules
- analytics
- dashboard experiences

## Core Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Lucide React
- Browser SpeechRecognition API
- Web App Manifest (PWA)
- Service Worker (PWA)
- Canvas API (confetti animation)

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
- Prisma migrations for production deploys
- sharp (PWA icon and splash screen generation)

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
- `MetadataRoute.Manifest` for typed PWA manifest
- `Viewport` export for theme color and viewport fit

### React

React powers the UI and interaction layer.

Concepts used here:

- `useState`
- `useEffect`
- `useCallback`
- controlled inputs
- conditional rendering
- modal-driven UI
- custom hooks for reusable side-effect logic

Examples:

- dashboard tabs
- expense modal state
- group settings modal
- realtime re-fetch logic
- spending summary tab
- voice-to-text draft flow
- UPI payment return detection hook
- toast notification hook

### TypeScript

TypeScript improves safety and maintainability.

Concepts to learn:

- object types
- unions
- optionals
- type inference
- custom type aliases
- module augmentation with `declare module`

Examples:

- API response shaping
- typed summary objects
- typed component state
- typed debt and category summary helpers
- `UpiApp` type for payment app config
- `PendingPayment` type for localStorage-persisted UPI intent
- `src/types/global.d.ts` for CSS side-effect import declarations

### Tailwind CSS

Tailwind is the styling system used across the UI.

Concepts to learn:

- utility-first styling
- responsive prefixes like `sm:` and `md:`
- spacing, flex, grid, typography
- state styling like `hover:` and `disabled:`
- `backdrop-blur` for glass-style sheets
- `pb-safe` for iOS safe area padding

Examples:

- mobile responsive layouts
- cards and modals
- icon-button controls in group settings
- UPI app picker bottom sheet
- toast slide-in animation

### Lucide React

Lucide provides the icon set.

Examples in this app:

- `Settings`
- `Plus`
- `ShieldCheck`
- `Trash2`
- `UserMinus`
- `Activity`
- `PieChart`
- `Smartphone` for UPI/payment settings section
- `CalendarDays` for member since display
- category-specific icons for spending analytics

### Browser SpeechRecognition API

This is used for the voice-to-text expense flow in supported browsers.

Concepts:

- microphone permissions
- secure contexts like `https://` or `localhost`
- transcript capture
- converting spoken text into a draft expense

File to study:

- `src/app/(dashboard)/groups/[groupId]/page.tsx`

### Canvas API

Used for the confetti animation that fires after a confirmed UPI settlement.

Concepts:

- creating a temporary full-screen canvas element
- drawing and animating particles with `requestAnimationFrame`
- cleaning up the canvas element after animation completes

File to study:

- `src/lib/confetti.ts`

No external confetti package is used — the animation is implemented with pure canvas drawing.

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
- migrations vs `db push`

Important note in this project:

- the Prisma client is generated into `src/generated/prisma`
- production deploys rely on tracked migrations
- analytics endpoints use Prisma `groupBy` and `aggregate`
- `upiId String?` was added to the `User` model for UPI payment support

### PostgreSQL

PostgreSQL stores the relational data.

Why it fits:

- users, groups, expenses, splits, settlements are relational
- supports indexes and structured queries well

Important relation examples:

- many-to-many via `GroupMember`
- one-to-many from `Group` to `Expense`
- one-to-many from `Expense` to `ExpenseSplit`

Planned direction:

- personal transactions should live in their own domain model
- group expenses should remain split-aware and group-bound
- analytics should aggregate per domain before building combined views

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
3. Server subscribes to that user's channels.
4. Writes publish Redis events.
5. SSE forwards `update` events.
6. Frontend fetches fresh dashboard/group/activity data.

The same event flow is also used to refresh user-level views like:

- direct individual payments
- dashboard spending summaries
- virtual solo-transaction group pages

### Progressive Web App (PWA)

The app is installable as a PWA on Android, iOS, and desktop.

Key files:

- `src/app/manifest.ts` — typed Web App Manifest via `MetadataRoute.Manifest`
- `public/sw.js` — service worker
- `public/offline.html` — offline fallback page
- `src/components/providers/PWAProvider.tsx` — registers the service worker in production only
- `src/components/providers/AppleSplashLinks.tsx` — injects 12 iOS splash screen link tags
- `public/icons/` — PNG icons at 192px, 512px, and 180px
- `scripts/generate-pwa-icons.mjs` — generates PNG icons and splash screens from the SVG logo using sharp

Concepts:

- Web App Manifest: `name`, `short_name`, `start_url`, `display`, `theme_color`, `icons`
- Service worker lifecycle: install, activate, fetch
- Cache strategies: cache-first for hashed static assets, network-first for pages
- Offline fallback: served only when `!navigator.onLine` to avoid false positives on LAN IP in dev
- iOS-specific: `apple-touch-icon`, `apple-touch-startup-image` with `media` queries for each device size
- `Viewport` export from Next.js for `themeColor` and `viewportFit: "cover"`
- Service worker only registered in production to prevent issues with self-signed certs on LAN IPs

### UPI Deep Links

UPI deep links allow SplitKaro to hand off payments to installed UPI apps.

Key file:

- `src/lib/upi.ts`

Concepts:

- `upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...` is the standard UPI intent URL
- Each UPI app also has its own scheme: `phonepe://pay`, `gpay://upi/pay`, `paytmmp://pay`, etc.
- Using app-specific schemes bypasses the OS default-app picker and opens the chosen app directly
- `window.location.href` triggers the deep link; control returns to the browser when the payment app is closed

### Payment Return Detection

After a user leaves the app to make a UPI payment, SplitKaro detects when they return.

Key file:

- `src/hooks/usePaymentReturn.ts`

Concepts:

- `visibilitychange` event fires when the user switches back to the browser tab or app
- A 1500ms delay gives the UPI app time to fully close before the modal appears
- The pending payment intent is stored in `localStorage` under `pending_payment` so it survives the app context switch
- `savePendingPayment` writes the intent, `clearPendingPayment` removes it after confirmation or cancellation

### Toast Notifications

Key file:

- `src/hooks/useToast.ts`
- `src/components/ui/Toast.tsx`

Concepts:

- `useToast` returns `showToast(message, type)` and `dismissToast`
- Toast auto-dismisses after 3.5 seconds
- Supports `success`, `error`, and `info` variants
- Slides in at the top center of the screen using CSS transforms

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

This project also supports optional simplified debt display:

- original pairwise view
- reduced transfer view that minimizes hops between members

Planned separation:

- group expenses keep split logic
- group settlements stay group-bound
- group validations remain isolated from personal-finance rules

### Individual payments

This app supports solo/direct payments too.

How it is modeled:

- save expense with `groupId: null`
- keep splits pointing to the friend involved
- include these in dashboard balances and activity
- expose them through a virtual `Individual Payments` group in the UI

Architectural note:

- this is the area targeted for refactor because it currently mixes direct/personal concepts with group-oriented structures
- the long-term direction is to isolate personal-finance logic instead of relying on `groupId: null`

### UPI Settle & Confirm flow

When a user owes money to a group member who has a UPI ID set:

1. Tapping Settle shows a bottom sheet listing 6 UPI apps.
2. User picks an app — a deep link opens the payment app with amount, receiver, and note pre-filled.
3. After returning, a confirmation modal asks if the payment went through.
4. Yes confirms and records the settlement in the database; confetti fires.
5. No cancels cleanly; the user can retry anytime.
6. If the receiver has no UPI ID, the manual settle modal appears instead.

### Expense categorization

Every expense can carry a category.

Used for:

- group-level category summaries
- individual payment categorization
- dashboard spending analytics
- category-based icons and charts

Categories currently include:

- Food
- Transport
- Groceries
- Entertainment
- Travel
- Rent
- Shopping
- Bills
- Health
- Other

Key file:

- `src/lib/expense-categories.ts`

### Voice and natural-language input

The app supports turning user input into expense drafts.

Flow:

1. user speaks or types a natural sentence
2. parser extracts amount, payer, participants, and splits
3. modal opens with a draft
4. user confirms or edits before saving

Key files:

- `src/app/api/groups/[groupId]/parse/route.ts`
- `src/app/(dashboard)/groups/[groupId]/page.tsx`

### Spending analytics

The dashboard includes a spending summary tab for the current user.

It groups expenses by category and splits them into:

- all paid expenses
- group expenses
- individual payments

Key file:

- `src/app/api/spending-summary/route.ts`

Next-step direction:

- personal analytics
- group analytics
- combined overview analytics

This keeps reporting accurate while avoiding mixed query logic.

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
- admin-only group settings changes
- case-insensitive user lookup by email
- UPI ID format validated on save with `/^[\w.-]+@[\w.-]+$/`

Next-step validation split:

- personal entries validate only user ownership and basic fields
- group entries validate membership, payer, receivers, and splits

## Database Models

### User

- account identity
- email/login info
- `upiId String?` — optional UPI ID for receiving payments
- relations to memberships, expenses, settlements, activities

### Group

- shared expense container
- archived/active state
- creator relationship
- simplify-debt toggle

### GroupMember

- join model between users and groups
- stores role like `ADMIN` or `MEMBER`

### Expense

- main payment record
- can belong to a group or be an individual payment with `groupId: null`
- stores a category for analytics and UI display

Long-term direction:

- separate personal-transaction modeling
- preserve group expense semantics without overloading one table for both domains

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
- `src/generated/prisma`

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
- `src/app/api/spending-summary/route.ts`
- `src/lib/expense-categories.ts`

### UPI payments

- `src/lib/upi.ts` — UPI app definitions and link generators
- `src/hooks/usePaymentReturn.ts` — visibilitychange detection and localStorage persistence
- `src/components/ui/UpiPickerSheet.tsx` — bottom sheet with 6 UPI app buttons
- `src/components/ui/PaymentConfirmModal.tsx` — post-payment confirmation dialog
- `src/lib/confetti.ts` — canvas-based confetti animation

### Profile and user settings

- `src/app/(dashboard)/me/page.tsx`
- `src/app/api/me/route.ts`

### Notifications

- `src/hooks/useToast.ts`
- `src/components/ui/Toast.tsx`

### PWA

- `src/app/manifest.ts`
- `public/sw.js`
- `public/offline.html`
- `src/components/providers/PWAProvider.tsx`
- `src/components/providers/AppleSplashLinks.tsx`
- `scripts/generate-pwa-icons.mjs`
- `public/icons/logo.svg`

### Dashboard and UI

- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/groups/[groupId]/page.tsx`
- `src/app/(dashboard)/me/page.tsx`
- `src/components/ui/SoloExpenseModal.tsx`
- `src/components/shared/BottomNav.tsx`

### TypeScript config

- `src/types/global.d.ts` — CSS side-effect import declaration

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
9. Learn payment categories and analytics summaries.
10. Learn voice input and parsing flow.
11. Learn UPI deep links and payment return detection.
12. Learn PWA manifest, service worker, and offline support.
13. Learn Redis pub/sub and SSE realtime flow.
14. Learn performance and scaling tradeoffs.

## Refactor Study Order

If you want to learn the next architectural step, study in this order:

1. current `Expense` + `ExpenseSplit` + `Settlement` flow
2. where `groupId: null` is currently used
3. personal-only transaction requirements
4. group-only validation requirements
5. analytics split: personal, group, combined
6. API migration strategy with backward compatibility
