# CLAUDE.md — SplitKaro AI

Rules and conventions Claude must follow in this project. Read this file before doing any work.

---

## Project Overview

**SplitKaro AI** is a full-stack PWA expense-sharing application.  
Stack: Next.js 15 (App Router) · React 19 · TypeScript 5 · Prisma 6 · PostgreSQL (Supabase) · Redis · Tailwind CSS 4 · NextAuth 4 · TanStack Query 5.

---

## Stack & Architecture Rules

### Next.js App Router
- All pages live under `src/app/`. Use **Server Components** by default; add `"use client"` only when interactivity or browser APIs are required.
- Route groups: `(auth)` for public pages, `(dashboard)` for protected pages.
- API routes live in `src/app/api/`. All endpoints must validate the session with `getServerSession(authOptions)` before touching the DB.
- Never use the Pages Router (`pages/` directory).

### TypeScript
- Strict TypeScript everywhere. No `any` unless unavoidable — use `unknown` + narrowing instead.
- Path alias `@/*` maps to `src/*`. Always use this alias, never relative `../../` paths.
- Type definitions go in `src/types/`. Augment NextAuth types there, not inline.
- Prisma-generated types live in `src/generated/prisma/` — import from there, never re-declare DB shapes.

### Database (Prisma + PostgreSQL)
- Schema file: `prisma/schema.prisma`. Never bypass Prisma to run raw SQL unless absolutely necessary.
- After schema changes run: `npx prisma migrate dev --name <description>`.
- Client output is `src/generated/prisma/` — do not change the `output` path.
- Always use `prisma.$transaction()` for multi-step writes that must be atomic.
- Add DB indexes for any new field used in `WHERE` or `ORDER BY` clauses.
- Cascade deletes are configured — respect them; do not manually delete child records before parents.

### Redis & Real-time
- Redis client lives in `src/lib/`. Reuse the singleton — never create a new client per request.
- Real-time: SSE over Redis pub/sub. Pattern: mutate DB → publish event → invalidate cache.
- Channel naming convention: `user:<userId>` and `group:<groupId>`.
- After any mutation that changes group or user state, call the appropriate publish + cache-invalidation helpers in `src/lib/`.

### Authentication
- NextAuth with Google OAuth only. Session strategy: JWT.
- Access `session.user.id` (injected via JWT callback) wherever user identity is needed.
- Never expose the raw NextAuth secret or JWT signing key.
- Protected server components/routes must call `getServerSession` — never trust client-sent user IDs.

---

## Frontend Rules

### State Management
- **Server state** → TanStack Query. Query hooks live in `src/hooks/queries/`. Do not fetch inside components directly — always use or create a query hook.
- **Local UI state** → `useState` / `useReducer`. Do not reach for a global store for ephemeral UI state.
- **Shared app state** → React Context (`src/contexts/`). Currently only `LanguageContext` exists; add contexts sparingly.
- Query config: `staleTime: 30s`, `gcTime: 5min`, `retry: 1`. Do not override per-query unless there is a specific reason.
- After mutations, invalidate queries via the cache-invalidation helpers in `src/lib/cache-invalidation.ts`. Do not call `queryClient.invalidateQueries` ad-hoc.

### Components
- Reusable UI primitives go in `src/components/ui/`.
- Feature-level components go alongside their feature in `src/features/` or in `src/components/`.
- Provider wrappers live in `src/components/providers/`.
- Keep components focused. Extract business logic into custom hooks under `src/hooks/`.

### Styling
- Tailwind CSS 4 only. No inline `style` props except for truly dynamic values (e.g., calculated percentages).
- Dark mode via the `class` strategy. Use `dark:` variants consistently — never hardcode colors.
- Use the HSL CSS variables defined in the Tailwind config for brand colors, don't use raw hex/rgb.
- Do not add a new CSS file unless absolutely necessary.

### Internationalization
- All user-visible strings must use the `LanguageContext` / locale files in `src/locales/`.
- Do not hardcode English strings in JSX outside of locale files.

---

## API Route Rules

- Every route handler must:
  1. Validate session (`getServerSession`) → return 401 if missing.
  2. Validate/parse request body — return 400 on bad input.
  3. Perform DB operations.
  4. Publish real-time event if relevant.
  5. Invalidate Redis cache if relevant.
  6. Return typed JSON response.
- Business logic belongs in `src/lib/` service files, not inside route handlers.
- Services that exist: `group-expense-service`, `group-settlement-service`, `personal-transaction-service`, `group-analytics-service`, `debts`. Add new services alongside these.
- Return consistent error shapes: `{ error: string }` with appropriate HTTP status codes.

---

## Security

- Never log secrets, tokens, or PII.
- Never trust client-supplied `userId` — always derive it from the verified session.
- Validate and sanitize all user input at route boundaries.
- No SQL injection risk because Prisma parameterizes everything — but if raw queries are ever used, always parameterize.
- Environment variables that must exist (from `.env.example`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`, `REDIS_URL` (or equivalent Supabase vars). Never commit `.env` — it is gitignored.
- UPI IDs are PII — treat them like payment data; never log or expose them unnecessarily.

---

## Dev Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run build:vercel # Vercel build (runs prisma migrate deploy first)
npm run lint         # ESLint
npx prisma studio    # Visual DB browser
npx prisma migrate dev --name <name>   # Create & apply a new migration
npx prisma generate  # Regenerate client after schema changes
node test-prisma.mjs # Test DB connectivity
```

---

## Project Conventions

### File Naming
- Pages / layouts / route handlers: lowercase with hyphens, Next.js convention (`page.tsx`, `layout.tsx`, `route.ts`).
- Components: PascalCase (`ExpenseCard.tsx`).
- Hooks: camelCase prefixed with `use` (`useGroupDetail.ts`).
- Lib/service files: kebab-case (`group-expense-service.ts`).

### Code Style
- No comments unless the **why** is non-obvious (hidden constraint, workaround, subtle invariant).
- No docstrings or multi-line comment blocks.
- Do not add unneeded abstractions. Three similar lines is fine. No premature DRY.
- No unused imports, variables, or dead code. ESLint will catch most of these.
- Prefer `async/await` over `.then()` chains.

### Testing & Edge Cases — MANDATORY

**Before marking any bug fix or feature as complete:**

1. **Run all existing tests / manual test flows** that are relevant to the changed area. Do not skip this.
2. **Identify and handle edge cases** for every new code path:
   - Empty/null/undefined inputs
   - Zero-amount / boundary-value scenarios (e.g., 0 expense, split rounding errors)
   - Concurrent mutations (two users editing the same group simultaneously)
   - Unauthenticated / unauthorized access attempts
   - Network failure mid-operation (partial writes)
   - Large datasets (many members, many expenses)
3. **Document any edge case that was explicitly handled** with a one-line comment explaining the constraint — this is one of the rare cases where a comment is required.
4. **Do not leave known edge cases unhandled** to address "later." If a case is out of scope, note it explicitly in the PR/commit message, not in code comments.

The goal: zero rework caused by skipped edge cases. A fix or feature is done only when it is robust, not just when the happy path works.

There is currently no automated test suite. Manual testing is the current approach. Do not add a testing framework without explicit user instruction. The file `test-prisma.mjs` is a one-off connectivity check, not a test suite.

---

## PWA Rules

- Service worker: `public/sw.js`. Do not break the SW registration logic.
- Web App Manifest: `public/manifest.json`. Keep it in sync when adding new icon sizes.
- PWA icon generation: `node scripts/generate-pwa-icons.mjs`. Run this after adding new icon source images.
- Splash screens are pre-generated for all major iOS device sizes in `assets/`. Do not delete them.
- Offline fallback: `public/offline.html`. Keep it self-contained (no external scripts).

---

## Deployment

- Host: Vercel. Config in `vercel.json`.
- Build command on Vercel: `npm run build:vercel` which runs `prisma migrate deploy && next build`.
- Never run `prisma migrate dev` in production — use `prisma migrate deploy`.
- Environment variables must be set in the Vercel project dashboard.

---

## What NOT To Do

- Do not use the Pages Router (`/pages` directory).
- Do not bypass NextAuth session validation in API routes.
- Do not create a second Prisma client instance — reuse the singleton.
- Do not create a second Redis client instance — reuse the singleton.
- Do not fetch data directly in Server/Client Components — use TanStack Query hooks.
- Do not hardcode user-facing strings — use locale files.
- Do not commit `.env`, certificates, or any secret files.
- Do not use `tailwind.config.js` (the project uses `.mjs`).
- Do not add a CSS framework other than Tailwind.
- Do not introduce a global state library (Redux, Zustand, etc.) — the current stack handles it without one.
- Do not add `console.log` statements in production code paths.
