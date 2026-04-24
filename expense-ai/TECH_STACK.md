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
- `UpiApp` type for iOS app config (id, name, bare launch scheme)
- `PendingPayment` type for localStorage-persisted UPI intent including `savedAt` for stale-entry expiry
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
- `assets/icons/` — PNG icons at 192px, 512px, and 180px
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

UPI deep links allow SplitKaro to open installed UPI apps for payment.

Key file:

- `src/lib/upi.ts`

Concepts:

- `upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...` is the NPCI-standard UPI intent URL — works reliably for native Android app-to-app Intent calls
- Pre-filling params via deep link is **not used** in SplitKaro because the app runs as a PWA: `window.location.href = "upi://..."` from a PWA web shell skips the Android Intent system, so params are silently dropped or cause app-side errors
- The same pre-fill problem affects iOS where app-specific schemes (`phonepe://pay?...`) route to wrong screens (e.g. PhonePe opens its QR scanner, not the payment form)
- Instead, the receiver's UPI ID is shown with a copy button and a step guide; the user copies the ID, switches to their app, and pastes it manually
- On iOS: `isIOS()` detects the platform and shows three buttons for PhonePe (`phonepe://`), Google Pay (`tez://`), and Paytm (`paytmmp://`) — bare launch schemes that open each app to its home screen without ambiguity
- On Android: a single "Open UPI App" button uses `upi://pay` (no params) to trigger the system app chooser

### Payment Return Detection

After a user leaves the app to make a UPI payment, SplitKaro detects when they return.

Key file:

- `src/hooks/usePaymentReturn.ts`

Concepts:

- `visibilitychange` event fires when the user switches back from the UPI app (background → foreground)
- An on-mount check (600ms delay) handles the PWA reload case where the app fully restarts after returning — `visibilitychange` does not fire in that case
- The pending payment intent is stored in `localStorage` under `pending_payment` so it survives both the app context switch and a full PWA reload
- `savedAt` timestamp on the stored intent auto-expires entries older than 10 minutes so stale intents don't cause false confirmation modals
- `savePendingPayment` writes the intent, `clearPendingPayment` removes it after confirmation or cancellation
- The callback is kept in a `useRef` so the `useEffect` runs once with an empty deps array — no risk of re-registering the listener on every render

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

1. Tapping Settle shows a bottom sheet with the receiver's UPI ID and a copy button.
2. A step guide on the sheet instructs: copy the UPI ID, then open your UPI app.
3. On iOS: three app buttons (PhonePe, Google Pay, Paytm) open each app via its bare launch scheme.
4. On Android: a single button opens the system app chooser via `upi://pay`.
5. User copies the UPI ID, opens their app, pastes it, and completes the payment manually.
6. On returning to SplitKaro, a confirmation modal asks if the payment went through.
7. Yes confirms and records the settlement in the database; confetti fires.
8. No cancels cleanly; the user can retry anytime.
9. If the receiver has no UPI ID, the manual settle modal appears instead.

Why copy-paste instead of pre-fill: `upi://pay?pa=...` pre-fill was designed for native Android Intent calls. From a PWA web shell, `window.location.href` skips the Intent system — params get dropped or cause app errors. On iOS, app-specific schemes route to wrong screens (PhonePe QR scanner, GPay home). Copy-paste is the only approach that works reliably across both platforms.

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
- settlement payer ID is normalized server-side to the database `user.id` (JWT session ID can diverge from DB ID in Google-auth flows)

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

- `src/lib/upi.ts` — `isIOS()` detection, `IOS_UPI_APPS` bare launch schemes, `generateUpiLink()` for Android
- `src/hooks/usePaymentReturn.ts` — visibilitychange + on-mount detection, localStorage persistence with 10-min TTL
- `src/components/ui/UpiPickerSheet.tsx` — platform-aware sheet: iOS 3-app grid, Android single button, copy-paste step guide
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
- `assets/icons/logo.svg`

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
