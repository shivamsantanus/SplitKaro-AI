import "dotenv/config";
import { createClient } from "redis";
import pkg from "../src/generated/prisma/index.js";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const TEST_DOMAIN = "@splitkaro.test";

const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function databaseHost() {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
}

// Fixed IDs so re-seeding keeps the same URLs, and so test rows stand out in
// Prisma Studio. User IDs are digit-repeats, groups start with "a0".
const U = {
  aarav: "11111111-1111-4111-8111-111111111111",
  diya: "22222222-2222-4222-8222-222222222222",
  rohan: "33333333-3333-4333-8333-333333333333",
  meera: "44444444-4444-4444-8444-444444444444",
  kabir: "55555555-5555-4555-8555-555555555555",
  vikram: "66666666-6666-4666-8666-666666666666",
  nikhil: "77777777-7777-4777-8777-777777777777",
};

const G = {
  goa: "a0000000-0000-4000-8000-000000000001",
  flat: "a0000000-0000-4000-8000-000000000002",
  manali: "a0000000-0000-4000-8000-000000000003",
};

// name === email local part on purpose: the dev-credentials provider rewrites
// name to the local part on every sign-in, so other names would drift on login.
const USERS = [
  { id: U.aarav, name: "aarav", email: `aarav${TEST_DOMAIN}`, upiId: "aarav@okhdfcbank" },
  { id: U.diya, name: "diya", email: `diya${TEST_DOMAIN}`, upiId: "diya@okaxis" },
  { id: U.rohan, name: "rohan", email: `rohan${TEST_DOMAIN}`, upiId: "rohan@oksbi" },
  { id: U.meera, name: "meera", email: `meera${TEST_DOMAIN}`, upiId: null },
  { id: U.kabir, name: "kabir", email: `kabir${TEST_DOMAIN}`, upiId: "kabir@ybl" },
];

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function getTestUserIds() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: TEST_DOMAIN } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);

  const placeholders = await prisma.user.findMany({
    where: {
      isPlaceholder: true,
      OR: [
        { placeholderOwnerId: { in: ids.length ? ids : ["-"] } },
        { placeholderGroupId: { in: Object.values(G) } },
      ],
    },
    select: { id: true },
  });

  return [...ids, ...placeholders.map((p) => p.id)];
}

async function clean() {
  const ids = await getTestUserIds();
  if (ids.length === 0) {
    console.log("Nothing to clean.");
    return ids;
  }

  // Groups first: their cascade clears expenses, splits, settlements, members,
  // activities and group-scoped placeholders in one shot.
  await prisma.group.deleteMany({ where: { id: { in: Object.values(G) } } });
  await prisma.group.deleteMany({ where: { createdById: { in: ids } } });

  // Expense/Settlement -> User is restrict, so anything left (group-less rows,
  // or rows inside a group a real user owns) has to go before the users do.
  await prisma.expenseSplit.deleteMany({ where: { userId: { in: ids } } });
  await prisma.expense.deleteMany({ where: { paidById: { in: ids } } });
  await prisma.settlement.deleteMany({
    where: { OR: [{ payerId: { in: ids } }, { receiverId: { in: ids } }] },
  });
  await prisma.activity.deleteMany({ where: { userId: { in: ids } } });
  await prisma.groupMember.deleteMany({ where: { userId: { in: ids } } });
  await prisma.personalTransaction.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });

  console.log(`Removed ${ids.length} test users and their data.`);
  return ids;
}

async function seed() {
  await prisma.user.createMany({ data: USERS });

  await prisma.user.create({
    data: {
      id: U.nikhil,
      name: "Nikhil (guest)",
      email: `placeholder+${U.nikhil}@splitkaro.local`,
      isPlaceholder: true,
      placeholderOwnerId: U.aarav,
    },
  });

  // Goa Trip: unsettled, has a guest member, exercises split rounding.
  await prisma.group.create({
    data: {
      id: G.goa,
      name: "Goa Trip (test)",
      createdById: U.aarav,
      members: {
        create: [
          { userId: U.aarav, role: "ADMIN" },
          { userId: U.diya, role: "MEMBER" },
          { userId: U.rohan, role: "MEMBER" },
          { userId: U.meera, role: "MEMBER" },
        ],
      },
    },
  });

  await prisma.user.create({
    data: {
      id: U.vikram,
      name: "Vikram (guest)",
      email: `placeholder+${U.vikram}@splitkaro.local`,
      isPlaceholder: true,
      placeholderGroupId: G.goa,
      memberships: { create: { groupId: G.goa, role: "MEMBER" } },
    },
  });

  await prisma.expense.create({
    data: {
      id: "e0000000-0000-4000-8000-000000000001",
      groupId: G.goa,
      description: "Hotel booking",
      category: "TRAVEL",
      amount: 12000,
      paidById: U.aarav,
      transactionDate: daysAgo(9),
      splits: {
        create: [U.aarav, U.diya, U.rohan, U.meera, U.vikram].map((userId) => ({
          userId,
          amount: 2400,
        })),
      },
    },
  });

  // 1000/3 does not divide evenly — the remainder paisa lands on the last split
  // so the split total still equals the expense amount.
  await prisma.expense.create({
    data: {
      id: "e0000000-0000-4000-8000-000000000002",
      groupId: G.goa,
      description: "Dinner at beach shack",
      category: "FOOD",
      amount: 1000,
      paidById: U.diya,
      transactionDate: daysAgo(7),
      splits: {
        create: [
          { userId: U.aarav, amount: 333.33 },
          { userId: U.diya, amount: 333.33 },
          { userId: U.rohan, amount: 333.34 },
        ],
      },
    },
  });

  // Smallest representable amount: one member's share rounds to zero.
  await prisma.expense.create({
    data: {
      id: "e0000000-0000-4000-8000-000000000003",
      groupId: G.goa,
      description: "Cab tip",
      category: "TRANSPORT",
      amount: 0.01,
      paidById: U.rohan,
      transactionDate: daysAgo(6),
      splits: {
        create: [
          { userId: U.rohan, amount: 0.01 },
          { userId: U.meera, amount: 0 },
        ],
      },
    },
  });

  await prisma.expense.create({
    data: {
      id: "e0000000-0000-4000-8000-000000000004",
      groupId: G.goa,
      description: "Scooter rental",
      category: "TRANSPORT",
      amount: 1500,
      paidById: U.meera,
      transactionDate: daysAgo(5),
      splits: {
        create: [U.aarav, U.diya, U.rohan, U.meera, U.vikram].map((userId) => ({
          userId,
          amount: 300,
        })),
      },
    },
  });

  await prisma.settlement.create({
    data: {
      id: "50000000-0000-4000-8000-000000000001",
      groupId: G.goa,
      payerId: U.rohan,
      receiverId: U.aarav,
      amount: 500,
      createdAt: daysAgo(3),
    },
  });

  // Flat 402: simplifyDebts on, so the debt graph gets collapsed.
  await prisma.group.create({
    data: {
      id: G.flat,
      name: "Flat 402 (test)",
      createdById: U.diya,
      simplifyDebts: true,
      members: {
        create: [
          { userId: U.diya, role: "ADMIN" },
          { userId: U.aarav, role: "MEMBER" },
          { userId: U.rohan, role: "MEMBER" },
        ],
      },
    },
  });

  await prisma.expense.create({
    data: {
      id: "e0000000-0000-4000-8000-000000000005",
      groupId: G.flat,
      description: "Electricity bill",
      category: "BILLS",
      amount: 2400,
      paidById: U.diya,
      transactionDate: daysAgo(12),
      splits: {
        create: [U.aarav, U.diya, U.rohan].map((userId) => ({ userId, amount: 800 })),
      },
    },
  });

  await prisma.expense.create({
    data: {
      id: "e0000000-0000-4000-8000-000000000006",
      groupId: G.flat,
      description: "Groceries run",
      category: "GROCERIES",
      amount: 3000,
      paidById: U.rohan,
      transactionDate: daysAgo(4),
      splits: {
        create: [U.aarav, U.diya, U.rohan].map((userId) => ({ userId, amount: 1000 })),
      },
    },
  });

  // Manali: archived and fully settled, so exit/archive guards should pass.
  await prisma.group.create({
    data: {
      id: G.manali,
      name: "Manali Trip (test, archived)",
      createdById: U.aarav,
      isArchived: true,
      members: {
        create: [
          { userId: U.aarav, role: "ADMIN" },
          { userId: U.rohan, role: "MEMBER" },
        ],
      },
    },
  });

  await prisma.expense.create({
    data: {
      id: "e0000000-0000-4000-8000-000000000007",
      groupId: G.manali,
      description: "Fuel",
      category: "TRANSPORT",
      amount: 2000,
      paidById: U.aarav,
      transactionDate: daysAgo(60),
      splits: {
        create: [
          { userId: U.aarav, amount: 1000 },
          { userId: U.rohan, amount: 1000 },
        ],
      },
    },
  });

  await prisma.settlement.create({
    data: {
      id: "50000000-0000-4000-8000-000000000002",
      groupId: G.manali,
      payerId: U.rohan,
      receiverId: U.aarav,
      amount: 1000,
      createdAt: daysAgo(58),
    },
  });

  // Personal ledger spans two months so month filters have data on both sides.
  await prisma.personalTransaction.createMany({
    data: [
      { ownerId: U.aarav, description: "Monthly salary", category: "SALARY", type: "INCOME", amount: 85000, transactionDate: daysAgo(2) },
      { ownerId: U.aarav, description: "Freelance invoice", category: "FREELANCE", type: "INCOME", amount: 12000, transactionDate: daysAgo(20) },
      { ownerId: U.aarav, description: "Metro card recharge", category: "TRANSPORT", type: "EXPENSE", amount: 500, transactionDate: daysAgo(1) },
      { ownerId: U.aarav, description: "Weekly groceries", category: "GROCERIES", type: "EXPENSE", amount: 2350.75, transactionDate: daysAgo(5) },
      { ownerId: U.aarav, description: "Netflix", category: "BILLS", type: "EXPENSE", amount: 649, transactionDate: daysAgo(33) },
      { ownerId: U.aarav, description: "Dentist", category: "HEALTH", type: "EXPENSE", amount: 1800, transactionDate: daysAgo(40) },
      { ownerId: U.diya, description: "Monthly salary", category: "SALARY", type: "INCOME", amount: 70000, transactionDate: daysAgo(2) },
      { ownerId: U.diya, description: "Gym membership", category: "HEALTH", type: "EXPENSE", amount: 2000, transactionDate: daysAgo(8) },
    ],
  });

  await prisma.activity.createMany({
    data: [
      { type: "GROUP_CREATED", message: "aarav created Goa Trip (test)", groupId: G.goa, userId: U.aarav, createdAt: daysAgo(10) },
      { type: "MEMBER_ADDED", message: "aarav added guest Vikram (guest)", groupId: G.goa, userId: U.aarav, createdAt: daysAgo(10) },
      { type: "EXPENSE_ADDED", message: "aarav added Hotel booking", groupId: G.goa, userId: U.aarav, createdAt: daysAgo(9) },
      { type: "EXPENSE_ADDED", message: "diya added Dinner at beach shack", groupId: G.goa, userId: U.diya, createdAt: daysAgo(7) },
      { type: "SETTLEMENT_ADDED", message: "rohan settled up with aarav", groupId: G.goa, userId: U.rohan, createdAt: daysAgo(3) },
      { type: "GROUP_CREATED", message: "diya created Flat 402 (test)", groupId: G.flat, userId: U.diya, createdAt: daysAgo(14) },
    ],
  });

  console.log(`Seeded ${USERS.length} test users, 3 groups, 7 group expenses, 2 guests.`);
}

// Seeding writes straight to Postgres, so any Redis entry for these users is now
// stale — the app would serve pre-seed group/analytics payloads until TTL.
async function flushCaches(ids) {
  const url = process.env.REDIS_URL;
  if (!url || ids.length === 0) return;

  const client = createClient({
    url,
    socket: { connectTimeout: 3000, reconnectStrategy: false },
  });
  client.on("error", () => {});

  try {
    await client.connect();
    const keys = [];
    for (const id of ids) {
      keys.push(
        `groups:${id}:active`,
        `groups:${id}:archived`,
        `group:solo-transactions:${id}`,
        `analytics:overview:${id}`,
        `analytics:groups:${id}`,
        `activities:${id}`,
        `friends:${id}`
      );
      for (const groupId of Object.values(G)) keys.push(`group:${groupId}:${id}`);
      keys.push(...(await client.keys(`personal:*:${id}:*`)));
    }
    if (keys.length) await client.del(keys);
    console.log(`Cleared ${keys.length} Redis keys.`);
  } catch {
    console.log("Redis unreachable — skipped cache flush (data may look stale for up to the cache TTL).");
  } finally {
    try {
      await client.destroy();
    } catch {
      // already closed
    }
  }
}

async function main() {
  // Seeding deletes and rewrites rows, so it must refuse a remote (possibly
  // live) database even when .env is pointed at one by mistake.
  const host = databaseHost();
  if (!LOCAL_DB_HOSTS.has(host)) {
    console.error(`Refusing to seed: DATABASE_URL host "${host || "unset"}" is not a local database.`);
    process.exitCode = 1;
    return;
  }

  const cleanOnly = process.argv.includes("--clean");
  const removed = await clean();
  if (!cleanOnly) await seed();
  await flushCaches(removed.length ? removed : Object.values(U));
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
