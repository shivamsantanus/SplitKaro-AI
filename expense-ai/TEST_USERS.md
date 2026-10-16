# Test Users

Seeded accounts and fixtures for local manual testing of SplitKaro AI.

Production login is Google OAuth only, but `src/lib/auth.ts` also registers a
`dev-credentials` provider that is **only** built when `NODE_ENV !== "production"`.
That is how you sign in as these users — no Google account needed, and the provider
never ships to production so it cannot become a live auth bypass.

---

## Quick start

```bash
npm run seed:test     # create (or reset) all test users + fixtures
npm run dev           # https://localhost:3000
```

Then open <https://localhost:3000/login>, scroll to the **"Dev login (local only)"**
box below the Google button, and enter:

- **Email** — any address from the table below
- **Password** — the value of `DEV_LOGIN_PASSWORD` in your `.env` (if the var is
  absent the provider falls back to `password`)

The same password works for every test user.

---

## Accounts

All test users live on the `@splitkaro.test` domain. `.test` is a reserved TLD
(RFC 6761) so these addresses can never resolve to a real mailbox.

IDs are fixed, so they survive a re-seed and can be pasted straight into URLs or curl.

| Email | Name | UPI ID | User ID | What it's for |
|---|---|---|---|---|
| `aarav@splitkaro.test` | aarav | `aarav@okhdfcbank` | `1111…1111` | **Primary account.** Admin of Goa Trip, is owed money, has a full personal ledger |
| `diya@splitkaro.test` | diya | `diya@okaxis` | `2222…2222` | Second real member. Admin of Flat 402, owes money in Goa Trip |
| `rohan@splitkaro.test` | rohan | `rohan@oksbi` | `3333…3333` | Third member. Has already part-settled, is a creditor in Flat 402 |
| `meera@splitkaro.test` | meera | *(none)* | `4444…4444` | **No UPI ID** — use to test the settle-up flow when the payee has no UPI |
| `kabir@splitkaro.test` | kabir | `kabir@ybl` | `5555…5555` | **In no group, has no data** — use to test empty states and onboarding |

Full IDs: `11111111-1111-4111-8111-111111111111` (aarav), and the same pattern with
`2222…`/`3333…`/`4444…`/`5555…` for the rest.

### Guests (placeholder users — cannot log in)

| Name | Scope | ID |
|---|---|---|
| Vikram (guest) | Group guest in Goa Trip | `6666…6666` |
| Nikhil (guest) | Individual-payment guest owned by aarav | `7777…7777` |

Guests get a synthetic `placeholder+<uuid>@splitkaro.local` email, matching what the
app generates. They have no session and are excluded from `findUserByEmail`.

---

## Seeded fixtures

### Groups

| Group | ID | Members | State |
|---|---|---|---|
| Goa Trip (test) | `a0000000-…-000000000001` | aarav (admin), diya, rohan, meera, Vikram (guest) | Active, unsettled, `simplifyDebts` off |
| Flat 402 (test) | `a0000000-…-000000000002` | diya (admin), aarav, rohan | Active, **`simplifyDebts` on** |
| Manali Trip (test, archived) | `a0000000-…-000000000003` | aarav (admin), rohan | **Archived** and fully settled |

Direct link: `https://localhost:3000/groups/a0000000-0000-4000-8000-000000000001`

### Expenses and the edge cases they cover

| Expense | Group | Amount | Why it's there |
|---|---|---|---|
| Hotel booking | Goa | ₹12,000 / 5 | Clean split including a guest member |
| Dinner at beach shack | Goa | ₹1,000 / 3 | **Rounding**: 333.33 / 333.33 / 333.34 — remainder paisa on the last split |
| Cab tip | Goa | ₹0.01 / 2 | **Boundary**: one share rounds to ₹0.00 |
| Scooter rental | Goa | ₹1,500 / 5 | Paid by a member who is not the group admin |
| Electricity bill | Flat 402 | ₹2,400 / 3 | Feeds the debt-simplification path |
| Groceries run | Flat 402 | ₹3,000 / 3 | Creates a cycle worth simplifying |
| Fuel | Manali | ₹2,000 / 2 | Settled in full, so exit/archive guards should pass |

Two settlements exist: rohan → aarav ₹500 (Goa, partial) and rohan → aarav ₹1,000
(Manali, closes the group out).

### Expected balances after a fresh seed

Signed off against `GET /api/groups` as aarav:

- **Goa Trip** — total spent ₹14,500.01; aarav is up **₹8,466.67**
  (diya owes 2,066.67 · rohan owes 1,900 · meera owes 2,100 · Vikram owes 2,400)
- **Flat 402** — total spent ₹5,400; aarav is down **₹1,800** (owes rohan 1,000, diya 800)

If your numbers differ after a fresh seed, something in the split or settlement
logic has regressed.

### Personal ledger

aarav has 6 personal transactions and diya has 2, deliberately spread across the
current **and** previous month so month filters, income-vs-expense totals and the
insights view all have data on both sides of the boundary.

---

## Running as more than one user at once

Sessions are cookies, so one browser profile holds exactly one session. To watch
real-time/SSE updates between two members:

- Window 1: normal browser → sign in as `aarav@splitkaro.test`
- Window 2: incognito / a second browser profile → sign in as `diya@splitkaro.test`

Add an expense in one and it should appear in the other without a refresh
(SSE over Redis pub/sub on the `group:<groupId>` channel).

---

## If something goes wrong

### The dev login box isn't on `/login`

It renders only when `NODE_ENV !== "production"`. Check you started with `npm run dev`,
not `npm run start` (which runs a production build). No rebuild will make it appear
in a production bundle — that's intentional.

### "Invalid dev credentials"

The provider compares `credentials.password.trim()` against
`DEV_LOGIN_PASSWORD.trim()`. Check for a stray quote or trailing space in `.env`,
and restart the dev server — env vars are read at boot, not per request.

### You need to test the real Google OAuth path

The seeded users can't do this — Google won't authenticate a `@splitkaro.test`
address. Use real Google accounts instead:

1. Google Cloud Console → **APIs & Services → OAuth consent screen**
2. With publishing status **Testing**, add each tester's Gmail under **Test users**
   (up to 100)
3. **Credentials → your OAuth client → Authorised redirect URIs**, add
   `https://localhost:3000/api/auth/callback/google`

The JWT callback creates the DB row on first sign-in, so no seeding is needed for
Google users — they just appear.

### You want to hit the API without a browser at all

`scripts/mint-test-session.mjs` signs a real NextAuth session JWT with your
`NEXTAUTH_SECRET` and prints a ready-made cookie:

```bash
npm run test:session aarav          # or a full email
```

It prints the correct cookie name for your setup and a curl line:

```bash
curl -k -H "Cookie: __Secure-next-auth.session-token=<token>" https://localhost:3000/api/me
```

The `-k` is needed because `npm run dev` uses `--experimental-https` with a
self-signed certificate. The cookie name depends on the `NEXTAUTH_URL` scheme —
`__Secure-next-auth.session-token` over https, `next-auth.session-token` over http —
which is why the script derives it rather than hardcoding it. To use it in a browser,
paste the name/value into DevTools → Application → Cookies for `https://localhost:3000`.

### Signing in wipes a test user's display name

Known behaviour, not a seed bug: the dev provider runs
`prisma.user.update({ data: { name } })` on **every** sign-in with `name` set to the
email's local part. That's why the seeded names are `aarav`, `diya`, … — they already
match, so nothing drifts. Renaming a test user in Profile will be undone at their next
dev sign-in. If you want edited names to stick, change the provider so it only sets
`name` when creating the row (`existingUser ?? await prisma.user.create(...)`).
UPI IDs are unaffected and do persist.

### The UI shows stale data after seeding

The seed writes straight to Postgres, so it flushes the affected Redis keys itself
(`groups:*`, `group:*`, `analytics:*`, `activities:*`, `friends:*`, `personal:*`).
If it printed *"Redis unreachable — skipped cache flush"*, either start Redis and
re-run, or hard-refresh; entries expire on their own at the cache TTL. TanStack Query
also holds a 30s `staleTime` client-side.

### Port 3000 is taken

Next will fall back to 3001, but `NEXTAUTH_URL` still points at 3000, so OAuth
callbacks and cookie scoping break. Stop the other process and restart on 3000 rather
than working on the fallback port.

### Seed fails with a foreign-key error

Run `npm run seed:test:clean` first, then `npm run seed:test`. Cleanup order matters —
`Expense.payer` and `Settlement.payer/receiver` are restrict, not cascade, so those
rows must go before the users do.

---

## Suggested manual test pass

1. **Auth** — dev login as aarav; confirm redirect to `/dashboard`; sign out;
   confirm `/groups/<id>` bounces to `/login` when signed out.
2. **Empty states** — sign in as kabir; dashboard, groups, analytics and activity
   should all render their empty states, not spinners or errors.
3. **Rounding** — open Goa Trip, check "Dinner at beach shack" splits sum to exactly
   ₹1,000 and that no balance is off by a paisa.
4. **Zero share** — check "Cab tip" renders meera's ₹0.00 share without a divide-by-zero
   or a phantom debt.
5. **Guest handling** — Vikram should appear as a member and carry a balance, but
   never receive a notification or an SSE event.
6. **Missing UPI** — settle up with meera; the UPI deep-link should be hidden or
   disabled rather than generating a malformed `upi://pay` URL.
7. **Simplify debts** — compare Flat 402's balances with `simplifyDebts` on vs off.
8. **Archived group** — Manali should be excluded from the active list, and adding a
   member to it must return 400.
9. **Concurrency** — two browser profiles, add an expense as aarav, confirm diya's
   view updates over SSE without a refresh.
10. **Authorization** — with the minted cookie for kabir, `GET /api/groups/<goa-id>`
    returns **403** and `GET /api/groups` returns `[]`; with no cookie, `/api/me`
    returns **401**. Anything else is a leak.
11. **Personal ledger** — as aarav, switch months and confirm income/expense totals
    change and the previous-month rows appear.

---

## Cleanup

```bash
npm run seed:test:clean
```

Removes only rows on `@splitkaro.test`, the three fixed test group IDs, and the
guests scoped to them. Verified to leave all other users, groups and expenses
untouched. `npm run seed:test` on its own is idempotent — it cleans first, then
re-seeds, so IDs and balances are identical every time.

**These fixtures are local-only.** Both `seed-test-users.mjs` and
`mint-test-session.mjs` refuse to run unless the `DATABASE_URL` host is `localhost`,
`127.0.0.1` or `[::1]`, so they can't write to, or forge sessions for, the
production Supabase instance.
