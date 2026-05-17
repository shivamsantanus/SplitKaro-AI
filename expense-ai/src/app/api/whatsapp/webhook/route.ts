import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  sendMessage,
  sendButtons,
  sendList,
  markAsRead,
} from "@/lib/whatsapp-bot";
import {
  parseExpensesFromText,
  type ParsedExpense,
} from "@/lib/telegram-expense-parser";
import { ensureRedis } from "@/lib/redis";
import prisma from "@/lib/prisma";
import { personalTransactionService } from "@/lib/personal-transaction-service";
import { invalidatePersonalCaches } from "@/lib/cache-invalidation";
import {
  EXPENSE_CATEGORIES,
  getExpenseCategoryLabel,
} from "@/lib/expense-categories";
import { groupExpenseService } from "@/lib/group-expense-service";
import { invalidateGroupCaches } from "@/lib/cache-invalidation";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_SECRET;

// ── Redis key helpers ──────────────────────────────────────────────────────

const PENDING_KEY = (phone: string) => `wa:pending:${phone}`;
const AWAITING_KEY = (phone: string) => `wa:awaiting:${phone}`;
const GEXPENSE_KEY = (phone: string) => `wa:gexp:${phone}`;
const GAWAITING_KEY = (phone: string) => `wa:gawait:${phone}`;
const GPENDING_KEY = (phone: string) => `wa:gpend:${phone}`;
const GSEL_KEY = (phone: string) => `wa:gsel:${phone}`;
const GSELAWAIT_KEY = (phone: string) => `wa:gselawait:${phone}`;
const PENDING_TTL = 300;
const AWAITING_TTL = 120;
const GEXPENSE_TTL = 300;

// ── WhatsApp message types ─────────────────────────────────────────────────

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        contacts?: WhatsAppContact[];
        messages?: WhatsAppMessage[];
        statuses?: unknown[];
      };
      field: string;
    }>;
  }>;
}

interface GroupMember {
  id: string;
  name: string;
}

interface GroupExpensePending {
  expense: ParsedExpense;
  groupId: string;
  groupName: string;
  memberCount: number;
  selectedMemberIds?: string[];
}

interface MemberSelectionState {
  members: GroupMember[];
  selected: string[];
}

interface AwaitingState {
  index: number;
  field: "a" | "n";
}

// ── DB helpers ────────────────────────────────────────────────────────────

async function getUserByPhone(phone: string) {
  return prisma.user.findUnique({
    where: { whatsappPhone: phone },
    select: { id: true, name: true },
  });
}

async function getUserGroups(userId: string) {
  return prisma.group.findMany({
    where: { members: { some: { userId } }, isArchived: false },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
}

// ── UI builders ───────────────────────────────────────────────────────────

function buildConfirmText(expenses: ParsedExpense[]): string {
  if (expenses.length === 1) {
    const e = expenses[0];
    return [
      "📝 *New Expense*",
      "",
      `Amount   : ₹${e.amount}`,
      `Category : ${getExpenseCategoryLabel(e.category)}`,
      `Note     : ${e.description}`,
      `Date     : ${e.transactionDate}`,
    ].join("\n");
  }
  const lines = expenses
    .map(
      (e, i) =>
        `${i + 1}. ₹${e.amount} · ${getExpenseCategoryLabel(e.category)} · ${e.description}`
    )
    .join("\n");
  return `📝 *${expenses.length} Expenses Found*\n\n${lines}`;
}

function buildGroupConfirmText(pending: GroupExpensePending): string {
  const splitCount = pending.selectedMemberIds?.length ?? pending.memberCount;
  const perPerson = (pending.expense.amount / splitCount).toFixed(2);
  return [
    "📝 *Group Expense*",
    "",
    `Amount   : ₹${pending.expense.amount}`,
    `Note     : ${pending.expense.description}`,
    `Category : ${getExpenseCategoryLabel(pending.expense.category)}`,
    `Group    : ${pending.groupName}`,
    `Paid by  : You`,
    `Split    : Equal (${splitCount} members) → ₹${perPerson} each`,
  ].join("\n");
}

// ── Command handlers ──────────────────────────────────────────────────────

async function handleStart(phone: string, firstName: string): Promise<void> {
  const user = await getUserByPhone(phone);

  if (user) {
    await sendMessage(
      phone,
      `Welcome back, ${user.name ?? firstName}! 👋\n\nYou're all set. Just send your expenses and I'll handle the rest.\n\n*Quick examples:*\n• lunch 200\n• coffee 80, metro 30\n• paid 500 for groceries\n\nFor group expenses send: /group dinner 800\nTo see recent expenses send: /recent`
    );
    return;
  }

  const redis = await ensureRedis();
  const token = crypto.randomBytes(16).toString("hex");
  await redis.setEx(`wa:link:${token}`, 900, JSON.stringify({ phone }));

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://splitkaro.tristech.in";

  await sendMessage(
    phone,
    `👋 Welcome to *SplitKaro AI!*\n\nI'm your personal expense assistant. Here's what I can do:\n\n💰 Track personal expenses instantly\n👥 Split group bills with friends\n📋 Show your recent spending\n🤖 Understand natural language\n\nTo get started, tap the link below to connect your SplitKaro account _(expires in 15 minutes)_:\n\n${appUrl}/link-whatsapp?token=${token}`
  );
}

async function sendWelcomePrompt(phone: string): Promise<void> {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://splitkaro.tristech.in";

  await sendButtons(
    phone,
    `👋 Hi! I'm *SplitKaro AI* — your expense tracking assistant.\n\n💰 Track personal expenses\n👥 Split group bills\n📊 View spending history\n\nSend */start* or tap the button below to link your account and get started!`,
    [{ id: "get_started", title: "🚀 Get Started" }]
  );

  const redis = await ensureRedis();
  const token = crypto.randomBytes(16).toString("hex");
  await redis.setEx(`wa:link:${token}`, 900, JSON.stringify({ phone }));
  await redis.setEx(`wa:welcome_token:${phone}`, 900, token);

  await sendMessage(
    phone,
    `Or open this link to connect:\n${appUrl}/link-whatsapp?token=${token}`
  );
}

async function handleHelp(phone: string): Promise<void> {
  await sendMessage(
    phone,
    [
      "📖 *SplitKaro AI — Help*",
      "",
      "━━━━━━━━━━━━━━━━━━",
      "💰 *Personal Expenses*",
      "Just type naturally:",
      "• lunch 200",
      "• paid 500 for groceries",
      "• coffee 80, metro 30, movie 350",
      "",
      "I'll parse it, show a preview, and let you Save, Edit or Cancel.",
      "",
      "━━━━━━━━━━━━━━━━━━",
      "👥 *Group Expenses*",
      "• /group dinner 800",
      "• /group — then type the expense",
      "",
      "Select your group, choose who to split with, and save.",
      "",
      "━━━━━━━━━━━━━━━━━━",
      "📋 *Commands*",
      "/start — link your account",
      "/recent — last 5 expenses",
      "/group — add a group expense",
      "/unlink — disconnect WhatsApp",
      "/cancel — cancel current action",
      "/help — show this message",
      "",
      "━━━━━━━━━━━━━━━━━━",
      "🌐 *Full app:* splitkaro.tristech.in",
    ].join("\n")
  );
}

async function handleRecent(phone: string, userId: string): Promise<void> {
  const transactions = await prisma.personalTransaction.findMany({
    where: { ownerId: userId },
    orderBy: { transactionDate: "desc" },
    take: 5,
    select: {
      description: true,
      amount: true,
      category: true,
      transactionDate: true,
    },
  });

  if (transactions.length === 0) {
    await sendMessage(
      phone,
      "No expenses yet. Send me an expense to get started!"
    );
    return;
  }

  const lines = transactions.map((t, i) => {
    const date = new Date(t.transactionDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
    return `${i + 1}. ₹${t.amount} · ${getExpenseCategoryLabel(t.category)} · ${t.description} (${date})`;
  });

  await sendMessage(phone, `📋 *Recent Expenses*\n\n${lines.join("\n")}`);
}

async function handleUnlink(phone: string, userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { whatsappPhone: null },
  });

  const redis = await ensureRedis();
  await Promise.all([
    redis.del(PENDING_KEY(phone)),
    redis.del(AWAITING_KEY(phone)),
  ]);

  await sendMessage(
    phone,
    "✅ Your WhatsApp has been unlinked from SplitKaro.\n\nSend /start to link again."
  );
}

// ── Personal expense flow ─────────────────────────────────────────────────

async function handleTextExpense(phone: string, text: string): Promise<void> {
  const redis = await ensureRedis();
  const expenses = await parseExpensesFromText(text);

  if (expenses.length === 0) {
    await sendMessage(
      phone,
      "❓ I couldn't detect any expenses in your message.\n\nTry something like:\n• lunch 200\n• paid 500 for groceries"
    );
    return;
  }

  await redis.setEx(PENDING_KEY(phone), PENDING_TTL, JSON.stringify(expenses));

  await sendButtons(phone, buildConfirmText(expenses), [
    { id: "save", title: "✅ Save All" },
    { id: "edit", title: "✏️ Edit" },
    { id: "cancel", title: "❌ Cancel" },
  ]);
}

async function handleSave(phone: string, userId: string): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(PENDING_KEY(phone));

  if (!raw) {
    await sendMessage(phone, "Session expired. Please resend your expenses.");
    return;
  }

  const expenses = JSON.parse(raw) as ParsedExpense[];

  await Promise.all(
    expenses.map((e) =>
      personalTransactionService.create({
        ownerId: userId,
        amount: e.amount,
        description: e.description,
        category: e.category,
        transactionDate: e.transactionDate,
      })
    )
  );

  const pairs = new Set(
    expenses.map((e) => {
      const d = new Date(e.transactionDate);
      return `${d.getFullYear()}-${d.getMonth() + 1}`;
    })
  );
  await Promise.all(
    [...pairs].map((pair) => {
      const [year, month] = pair.split("-").map(Number);
      return invalidatePersonalCaches(userId, year, month);
    })
  );

  await redis.del(PENDING_KEY(phone));

  const savedText =
    expenses.length === 1
      ? `✅ Saved: ₹${expenses[0].amount} · ${getExpenseCategoryLabel(expenses[0].category)} · ${expenses[0].description}`
      : `✅ Saved ${expenses.length} expenses`;

  await sendMessage(phone, savedText);
}

async function handleCancel(phone: string): Promise<void> {
  const redis = await ensureRedis();
  await Promise.all([
    redis.del(PENDING_KEY(phone)),
    redis.del(AWAITING_KEY(phone)),
    redis.del(GEXPENSE_KEY(phone)),
    redis.del(GPENDING_KEY(phone)),
    redis.del(GAWAITING_KEY(phone)),
    redis.del(GSEL_KEY(phone)),
    redis.del(GSELAWAIT_KEY(phone)),
  ]);
  await sendMessage(phone, "❌ Cancelled.");
}

async function handleEdit(phone: string): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(PENDING_KEY(phone));

  if (!raw) {
    await sendMessage(phone, "Session expired. Please resend your expenses.");
    return;
  }

  const expenses = JSON.parse(raw) as ParsedExpense[];

  if (expenses.length === 1) {
    const e = expenses[0];
    await sendButtons(
      phone,
      `✏️ *Edit Expense*\n\n₹${e.amount} · ${getExpenseCategoryLabel(e.category)} · ${e.description}\n\nWhat would you like to change?`,
      [
        { id: "ef:0:a", title: "💰 Amount" },
        { id: "ef:0:n", title: "📝 Note" },
        { id: "ef:0:c", title: "🏷️ Category" },
      ]
    );
  } else {
    await sendList(
      phone,
      "✏️ Which expense to edit?",
      "Select Expense",
      expenses.map((e, i) => ({
        id: `ei:${i}`,
        title: `${i + 1}. ₹${e.amount}`,
        description: e.description.slice(0, 72),
      }))
    );
  }
}

async function handleEditExpenseSelect(
  phone: string,
  index: number
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(PENDING_KEY(phone));

  if (!raw) {
    await sendMessage(phone, "Session expired. Please resend your expenses.");
    return;
  }

  const expenses = JSON.parse(raw) as ParsedExpense[];
  const e = expenses[index];

  if (!e) {
    await sendMessage(phone, "Invalid selection.");
    return;
  }

  await sendButtons(
    phone,
    `✏️ *Edit Expense ${index + 1}*\n\n₹${e.amount} · ${getExpenseCategoryLabel(e.category)} · ${e.description}\n\nWhat would you like to change?`,
    [
      { id: `ef:${index}:a`, title: "💰 Amount" },
      { id: `ef:${index}:n`, title: "📝 Note" },
      { id: `ef:${index}:c`, title: "🏷️ Category" },
    ]
  );
}

async function handleEditField(
  phone: string,
  index: number,
  field: string
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(PENDING_KEY(phone));

  if (!raw) {
    await sendMessage(phone, "Session expired. Please resend your expenses.");
    return;
  }

  if (field === "c") {
    await sendList(
      phone,
      "🏷️ Select a category:",
      "Pick Category",
      EXPENSE_CATEGORIES.map((cat) => ({
        id: `ec:${index}:${cat.value}`,
        title: cat.label,
      }))
    );
  } else {
    const expenses = JSON.parse(raw) as ParsedExpense[];
    const e = expenses[index];
    const fieldLabel = field === "a" ? "amount (e.g. 250)" : "note/description";

    await redis.setEx(
      AWAITING_KEY(phone),
      AWAITING_TTL,
      JSON.stringify({ index, field: field as "a" | "n" } satisfies AwaitingState)
    );

    await sendMessage(
      phone,
      `✏️ Send the new ${fieldLabel} for:\n${e.description} · ₹${e.amount}\n\nOr send /cancel to go back.`
    );
  }
}

async function handleEditCategory(
  phone: string,
  index: number,
  category: string
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(PENDING_KEY(phone));

  if (!raw) {
    await sendMessage(phone, "Session expired. Please resend your expenses.");
    return;
  }

  const expenses = JSON.parse(raw) as ParsedExpense[];

  if (!expenses[index]) {
    await sendMessage(phone, "Invalid selection.");
    return;
  }

  expenses[index].category = category;
  await redis.setEx(PENDING_KEY(phone), PENDING_TTL, JSON.stringify(expenses));

  await sendButtons(phone, buildConfirmText(expenses), [
    { id: "save", title: "✅ Save All" },
    { id: "edit", title: "✏️ Edit" },
    { id: "cancel", title: "❌ Cancel" },
  ]);
}

async function handleAwaitingInput(
  phone: string,
  text: string,
  state: AwaitingState
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(PENDING_KEY(phone));

  if (!raw) {
    await sendMessage(phone, "Session expired. Please resend your expenses.");
    await redis.del(AWAITING_KEY(phone));
    return;
  }

  const expenses = JSON.parse(raw) as ParsedExpense[];
  const { index, field } = state;

  if (field === "a") {
    const amount = parseFloat(text.replace(/[^\d.]/g, ""));
    if (isNaN(amount) || amount <= 0) {
      await sendMessage(
        phone,
        "❌ Invalid amount. Send a valid number (e.g. 250):"
      );
      return;
    }
    expenses[index].amount = amount;
  } else {
    if (!text.trim()) {
      await sendMessage(phone, "❌ Note can't be empty. Send a description:");
      return;
    }
    expenses[index].description = text.trim();
  }

  await redis.setEx(PENDING_KEY(phone), PENDING_TTL, JSON.stringify(expenses));
  await redis.del(AWAITING_KEY(phone));

  await sendButtons(phone, buildConfirmText(expenses), [
    { id: "save", title: "✅ Save All" },
    { id: "edit", title: "✏️ Edit" },
    { id: "cancel", title: "❌ Cancel" },
  ]);
}

// ── Group expense flow ────────────────────────────────────────────────────

async function handleGroupCommand(
  phone: string,
  userId: string,
  expenseText: string
): Promise<void> {
  const redis = await ensureRedis();
  const groups = await getUserGroups(userId);

  if (groups.length === 0) {
    await sendMessage(
      phone,
      "You're not part of any group yet. Create or join a group in the SplitKaro app first."
    );
    return;
  }

  if (!expenseText.trim()) {
    await redis.setEx(GAWAITING_KEY(phone), AWAITING_TTL, "1");
    await sendMessage(
      phone,
      "What's the expense?\n\nSend it like: dinner 500"
    );
    return;
  }

  const expenses = await parseExpensesFromText(expenseText);
  if (expenses.length === 0) {
    await sendMessage(
      phone,
      "❓ Couldn't detect an expense. Try: /group dinner 500"
    );
    return;
  }

  await redis.setEx(
    GEXPENSE_KEY(phone),
    GEXPENSE_TTL,
    JSON.stringify(expenses[0])
  );

  await sendList(
    phone,
    "👥 Which group?",
    "Select Group",
    groups.map((g) => ({ id: `gs:${g.id}`, title: g.name.slice(0, 24) }))
  );
}

async function handleGroupSelect(
  phone: string,
  userId: string,
  groupId: string
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(GEXPENSE_KEY(phone));

  if (!raw) {
    await sendMessage(phone, "Session expired. Use /group again.");
    return;
  }

  const expense = JSON.parse(raw) as ParsedExpense;

  const group = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId } } },
    select: { id: true, name: true, _count: { select: { members: true } } },
  });

  if (!group) {
    await sendMessage(phone, "Group not found.");
    return;
  }

  const pending: GroupExpensePending = {
    expense,
    groupId: group.id,
    groupName: group.name,
    memberCount: group._count.members,
  };

  await redis.setEx(GPENDING_KEY(phone), GEXPENSE_TTL, JSON.stringify(pending));
  await redis.del(GEXPENSE_KEY(phone));

  await sendButtons(phone, buildGroupConfirmText(pending), [
    { id: "gsave", title: "✅ Save" },
    { id: "gchsplit", title: "👥 Custom Split" },
    { id: "gcancel", title: "❌ Cancel" },
  ]);
}

async function handleGroupSave(phone: string, userId: string): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(GPENDING_KEY(phone));

  if (!raw) {
    await sendMessage(phone, "Session expired. Use /group again.");
    return;
  }

  const pending = JSON.parse(raw) as GroupExpensePending;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  if (!user) {
    await sendMessage(phone, "User not found.");
    return;
  }

  // Distribute remainder to the first member to avoid floating-point drift
  let splits: Array<{ userId: string; amount: number }> | undefined;
  if (pending.selectedMemberIds) {
    const n = pending.selectedMemberIds.length;
    const base = Math.floor((pending.expense.amount / n) * 100) / 100;
    const remainder =
      Math.round((pending.expense.amount - base * n) * 100) / 100;
    splits = pending.selectedMemberIds.map((uid, i) => ({
      userId: uid,
      amount: i === 0 ? base + remainder : base,
    }));
  }

  await groupExpenseService.create({
    groupId: pending.groupId,
    requesterId: userId,
    actorName: user.name ?? user.email,
    actorEmail: user.email,
    amount: pending.expense.amount,
    description: pending.expense.description,
    category: pending.expense.category,
    transactionDate: pending.expense.transactionDate,
    paidById: userId,
    splits,
  });

  await invalidateGroupCaches(pending.groupId);
  await redis.del(GPENDING_KEY(phone));

  await sendMessage(
    phone,
    `✅ Saved to *${pending.groupName}*: ₹${pending.expense.amount} · ${pending.expense.description}`
  );
}

async function handleChangeSplit(
  phone: string,
  userId: string
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(GPENDING_KEY(phone));

  if (!raw) {
    await sendMessage(phone, "Session expired. Use /group again.");
    return;
  }

  const pending = JSON.parse(raw) as GroupExpensePending;

  const memberships = await prisma.groupMember.findMany({
    where: { groupId: pending.groupId },
    select: { user: { select: { id: true, name: true, email: true } } },
  });

  const members: GroupMember[] = memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? m.user.email,
  }));

  const selected = pending.selectedMemberIds ?? members.map((m) => m.id);
  const selState: MemberSelectionState = { members, selected };
  await redis.setEx(GSEL_KEY(phone), GEXPENSE_TTL, JSON.stringify(selState));
  await redis.setEx(GSELAWAIT_KEY(phone), GEXPENSE_TTL, "1");

  const memberList = members
    .map((m, i) => `${i + 1}. ${selected.includes(m.id) ? "✅" : "❌"} ${m.name}`)
    .join("\n");

  await sendMessage(
    phone,
    `👥 *Select members to split with:*\n\n${memberList}\n\nReply with member numbers separated by commas.\nExample: *1,3* to include members 1 and 3.\n\nOr send /cancel to go back.`
  );
}

async function handleMemberSelectionInput(
  phone: string,
  text: string
): Promise<void> {
  const redis = await ensureRedis();
  const [selRaw, pendingRaw] = await Promise.all([
    redis.get(GSEL_KEY(phone)),
    redis.get(GPENDING_KEY(phone)),
  ]);

  if (!selRaw || !pendingRaw) {
    await sendMessage(phone, "Session expired. Use /group again.");
    await redis.del(GSELAWAIT_KEY(phone));
    return;
  }

  const selState = JSON.parse(selRaw) as MemberSelectionState;
  const pending = JSON.parse(pendingRaw) as GroupExpensePending;

  const indices = text
    .split(",")
    .map((s) => parseInt(s.trim(), 10) - 1)
    .filter((i) => i >= 0 && i < selState.members.length);

  if (indices.length === 0) {
    await sendMessage(
      phone,
      `❌ Invalid input. Send member numbers separated by commas.\nExample: 1,3\n\nMembers:\n${selState.members.map((m, i) => `${i + 1}. ${m.name}`).join("\n")}`
    );
    return;
  }

  pending.selectedMemberIds = indices.map((i) => selState.members[i].id);

  await redis.setEx(GPENDING_KEY(phone), GEXPENSE_TTL, JSON.stringify(pending));
  await Promise.all([
    redis.del(GSEL_KEY(phone)),
    redis.del(GSELAWAIT_KEY(phone)),
  ]);

  await sendButtons(phone, buildGroupConfirmText(pending), [
    { id: "gsave", title: "✅ Save" },
    { id: "gchsplit", title: "👥 Custom Split" },
    { id: "gcancel", title: "❌ Cancel" },
  ]);
}

async function handleGroupCancel(phone: string): Promise<void> {
  const redis = await ensureRedis();
  await Promise.all([
    redis.del(GEXPENSE_KEY(phone)),
    redis.del(GPENDING_KEY(phone)),
    redis.del(GAWAITING_KEY(phone)),
    redis.del(GSEL_KEY(phone)),
    redis.del(GSELAWAIT_KEY(phone)),
  ]);
  await sendMessage(phone, "❌ Cancelled.");
}

// ── Greeting & about handlers ─────────────────────────────────────────────

const GREETING_PATTERNS = /^(hi|hello|hey|hii|helo|hola|namaste|sup|yo|howdy|good\s*(morning|afternoon|evening|night)|what.?s\s*up|👋|🙏)[\s!?.]*$/i;
const ABOUT_PATTERNS = /^(what\s*(is|are|can)\s*(this|you|splitkaro)|about|info|who\s*are\s*you|tell\s*me\s*more|app\s*info|features?)[\s!?.]*$/i;

async function handleGreeting(phone: string, name: string): Promise<void> {
  await sendButtons(
    phone,
    `👋 Hey ${name}! Welcome to *SplitKaro AI*\n\nI'm your personal expense assistant on WhatsApp.\n\n💰 Track personal expenses instantly\n👥 Split group bills with friends\n📊 View your spending history\n🤖 Just type naturally — I understand you\n\nSend */start* to link your account and get going!`,
    [{ id: "get_started", title: "🚀 Get Started" }]
  );
}

async function handleGreetingLinked(phone: string, name: string): Promise<void> {
  await sendMessage(
    phone,
    `👋 Hey ${name}!\n\nJust send me your expenses and I'll handle the rest.\n\n*Examples:*\n• lunch 200\n• coffee 80, metro 30\n• paid 500 for groceries yesterday\n\nFor group expenses: /group dinner 800\nRecent expenses: /recent\nAll commands: /help`
  );
}

async function handleAbout(phone: string): Promise<void> {
  await sendMessage(
    phone,
    [
      "ℹ️ *About SplitKaro AI*",
      "",
      "SplitKaro AI is an expense tracking and bill splitting app that works right here on WhatsApp.",
      "",
      "*What I can do:*",
      "💰 Track your personal expenses",
      "👥 Split group bills with friends",
      "📊 Show your recent spending",
      "✏️ Edit expenses before saving",
      "🤖 Understand natural language",
      "",
      "*How it works:*",
      "Just send a message like _lunch 200_ and I'll parse it, show a preview, and save it with one tap.",
      "",
      `🌐 *Full app:* splitkaro.tristech.in`,
      "",
      "Send /start to link your account and begin!",
    ].join("\n")
  );
}

// ── Message router ────────────────────────────────────────────────────────

async function processMessage(
  message: WhatsAppMessage,
  contactName: string
): Promise<void> {
  const phone = message.from;

  await markAsRead(message.id).catch(() => {});

  // Interactive responses (button clicks / list selections)
  if (message.type === "interactive" && message.interactive) {
    const { interactive } = message;
    let data: string | undefined;

    if (interactive.type === "button_reply" && interactive.button_reply) {
      data = interactive.button_reply.id;
    } else if (interactive.type === "list_reply" && interactive.list_reply) {
      data = interactive.list_reply.id;
    }

    if (!data) return;

    if (data === "cancel") { await handleCancel(phone); return; }
    if (data === "gcancel") { await handleGroupCancel(phone); return; }
    if (data === "get_started") { await handleStart(phone, "there"); return; }

    const user = await getUserByPhone(phone);
    if (!user) {
      await sendWelcomePrompt(phone);
      return;
    }

    if (data === "save") {
      await handleSave(phone, user.id);
    } else if (data === "edit") {
      await handleEdit(phone);
    } else if (data === "gsave") {
      await handleGroupSave(phone, user.id);
    } else if (data === "gchsplit") {
      await handleChangeSplit(phone, user.id);
    } else if (data.startsWith("ei:")) {
      await handleEditExpenseSelect(phone, parseInt(data.slice(3), 10));
    } else if (data.startsWith("ef:")) {
      const [, idx, field] = data.split(":");
      await handleEditField(phone, parseInt(idx, 10), field);
    } else if (data.startsWith("ec:")) {
      const [, idx, category] = data.split(":");
      await handleEditCategory(phone, parseInt(idx, 10), category);
    } else if (data.startsWith("gs:")) {
      await handleGroupSelect(phone, user.id, data.slice(3));
    }

    return;
  }

  // Text messages only beyond this point
  if (message.type !== "text" || !message.text?.body) return;

  const text = message.text.body.trim();

  if (text.startsWith("/")) {
    const command = text.split(" ")[0].toLowerCase();

    if (command === "/start") { await handleStart(phone, contactName); return; }
    if (command === "/help") { await handleHelp(phone); return; }
    if (command === "/cancel") { await handleCancel(phone); return; }

    const user = await getUserByPhone(phone);
    if (!user) {
      await sendWelcomePrompt(phone);
      return;
    }

    if (command === "/recent") {
      await handleRecent(phone, user.id);
    } else if (command === "/unlink") {
      await handleUnlink(phone, user.id);
    } else if (command === "/group") {
      const expenseText = text.slice(text.indexOf(" ") + 1).trim();
      const cleanText = expenseText === text.trim() ? "" : expenseText;
      await handleGroupCommand(phone, user.id, cleanText);
    } else {
      await handleHelp(phone);
    }

    return;
  }

  // Non-command text — requires auth
  const user = await getUserByPhone(phone);
  if (!user) {
    if (GREETING_PATTERNS.test(text) || ABOUT_PATTERNS.test(text)) {
      await handleGreeting(phone, contactName);
    } else {
      await sendWelcomePrompt(phone);
    }
    return;
  }

  // Greetings and about queries for linked users
  if (GREETING_PATTERNS.test(text)) {
    await handleGreetingLinked(phone, user.name ?? contactName);
    return;
  }
  if (ABOUT_PATTERNS.test(text)) {
    await handleAbout(phone);
    return;
  }

  const redis = await ensureRedis();

  const awaitingRaw = await redis.get(AWAITING_KEY(phone));
  if (awaitingRaw) {
    const state = JSON.parse(awaitingRaw) as AwaitingState;
    await handleAwaitingInput(phone, text, state);
    return;
  }

  const gselAwaitingRaw = await redis.get(GSELAWAIT_KEY(phone));
  if (gselAwaitingRaw) {
    await handleMemberSelectionInput(phone, text);
    return;
  }

  const gawaitingRaw = await redis.get(GAWAITING_KEY(phone));
  if (gawaitingRaw) {
    await redis.del(GAWAITING_KEY(phone));
    const groups = await getUserGroups(user.id);
    const expenses = await parseExpensesFromText(text);
    if (expenses.length === 0) {
      await sendMessage(
        phone,
        "❓ Couldn't detect an expense. Try: dinner 500"
      );
      return;
    }
    await redis.setEx(
      GEXPENSE_KEY(phone),
      GEXPENSE_TTL,
      JSON.stringify(expenses[0])
    );
    await sendList(
      phone,
      "👥 Which group?",
      "Select Group",
      groups.map((g) => ({ id: `gs:${g.id}`, title: g.name.slice(0, 24) }))
    );
    return;
  }

  await handleTextExpense(phone, text);
}

// ── Route handlers ────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: WhatsAppWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ error: "Unknown object" }, { status: 400 });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const { messages = [], contacts = [] } = change.value;

      for (const message of messages) {
        const contact = contacts.find((c) => c.wa_id === message.from);
        const contactName = contact?.profile.name ?? "there";

        try {
          await processMessage(message, contactName);
        } catch {
          // Swallow errors so Meta doesn't retry endlessly
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// Disable body size limit for webhook payloads
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
