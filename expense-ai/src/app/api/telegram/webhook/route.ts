import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  sendMessage,
  editMessageText,
  answerCallbackQuery,
} from "@/lib/telegram-bot";
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

// Derived from bot token — must match what setup/route.ts sends to Telegram
const WEBHOOK_SECRET = crypto
  .createHash("sha256")
  .update(process.env.TELEGRAM_BOT_TOKEN ?? "")
  .digest("hex")
  .slice(0, 32);

// ── Telegram update types ──────────────────────────────────────────────────

interface TelegramUser {
  id: number;
  first_name: string;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: { id: number };
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message: TelegramMessage;
  data: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

// ── Redis key helpers ──────────────────────────────────────────────────────

const PENDING_KEY = (chatId: number) => `tg:pending:${chatId}`;
const AWAITING_KEY = (chatId: number) => `tg:awaiting:${chatId}`;
const PENDING_TTL = 300; // 5 min
const AWAITING_TTL = 120; // 2 min

// Group expense flow keys
const GEXPENSE_KEY = (chatId: number) => `tg:gexp:${chatId}`;
const GAWAITING_KEY = (chatId: number) => `tg:gawait:${chatId}`;
const GPENDING_KEY = (chatId: number) => `tg:gpend:${chatId}`;
const GSEL_KEY = (chatId: number) => `tg:gsel:${chatId}`;
const GEXPENSE_TTL = 300; // 5 min

interface GroupMember {
  id: string;
  name: string;
}

interface GroupExpensePending {
  expense: ParsedExpense;
  groupId: string;
  groupName: string;
  memberCount: number;
  selectedMemberIds?: string[]; // undefined = all members equal split
}

interface MemberSelectionState {
  members: GroupMember[];
  selected: string[];
}

interface AwaitingState {
  index: number;
  field: "a" | "n"; // amount or note
  messageId: number;
}

// ── UI builders ───────────────────────────────────────────────────────────

function buildConfirmCard(expenses: ParsedExpense[]): {
  text: string;
  replyMarkup: object;
} {
  let text: string;

  if (expenses.length === 1) {
    const e = expenses[0];
    text = [
      "📝 <b>New Expense</b>",
      "",
      `Amount   : ₹${e.amount}`,
      `Category : ${getExpenseCategoryLabel(e.category)}`,
      `Note     : ${e.description}`,
      `Date     : ${e.transactionDate}`,
    ].join("\n");
  } else {
    const lines = expenses
      .map(
        (e, i) =>
          `${i + 1}. ₹${e.amount} · ${getExpenseCategoryLabel(e.category)} · ${e.description}`
      )
      .join("\n");
    text = `📝 <b>${expenses.length} Expenses Found</b>\n\n${lines}`;
  }

  return {
    text,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "✅ Save All", callback_data: "save" },
          { text: "✏️ Edit", callback_data: "edit" },
          { text: "❌ Cancel", callback_data: "cancel" },
        ],
      ],
    },
  };
}

// ── DB helpers ────────────────────────────────────────────────────────────

async function getUserByChat(chatId: number) {
  return prisma.user.findUnique({
    where: { telegramChatId: String(chatId) },
    select: { id: true, name: true },
  });
}

// ── Command handlers ──────────────────────────────────────────────────────

async function handleStart(chatId: number, firstName: string): Promise<void> {
  const user = await getUserByChat(chatId);

  if (user) {
    await sendMessage(
      chatId,
      `👋 Welcome back, <b>${user.name ?? firstName}</b>!\n\nYour account is linked and ready. Just send me an expense to get started.\n\n<b>Personal expense:</b>\n<code>lunch 200</code>\n<code>coffee 80, metro 30, groceries 500</code>\n\n<b>Group expense:</b>\n<code>/group dinner 500</code>\n\nType /help to see everything I can do.`
    );
    return;
  }

  const redis = await ensureRedis();
  const token = crypto.randomBytes(16).toString("hex");
  await redis.setEx(
    `tg:link:${token}`,
    900,
    JSON.stringify({ chatId: String(chatId) })
  );

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://splitkaro.tristech.in";

  await sendMessage(
    chatId,
    `👋 Welcome to <b>SplitKaro</b>!\n\nAdd personal expenses and split group bills — without opening the app.\n\nTo get started, link your SplitKaro account by tapping the button below.\n\n⏱ The link expires in <b>15 minutes</b>.`,
    {
      inline_keyboard: [
        [{ text: "🔗 Link My Account", url: `${appUrl}/link-telegram?token=${token}` }],
      ],
    }
  );
}

async function handleHelp(chatId: number): Promise<void> {
  await sendMessage(
    chatId,
    [
      "📖 <b>SplitKaro Bot — What I can do</b>",
      "",
      "━━━━━━━━━━━━━━━━━━",
      "💸 <b>Personal Expenses</b>",
      "Just send your expense naturally — no commands needed:",
      "• <code>lunch 200</code>",
      "• <code>paid 500 for groceries</code>",
      "• <code>coffee 80, metro 30, groceries 500</code>",
      "",
      "I'll parse it with AI, show a confirmation card, and save it to your account when you confirm.",
      "",
      "━━━━━━━━━━━━━━━━━━",
      "👥 <b>Group Expenses</b>",
      "• <code>/group dinner 500</code> — add an expense to a group",
      "• Select which group from your list",
      "• Choose who to split with (or keep all members)",
      "• Confirm and save — done!",
      "",
      "━━━━━━━━━━━━━━━━━━",
      "📋 <b>Commands</b>",
      "/start — link your SplitKaro account",
      "/recent — view your last 5 personal expenses",
      "/group [expense] — add a group expense",
      "/cancel — cancel whatever is in progress",
      "/unlink — disconnect this Telegram account",
      "/help — show this message",
      "",
      "━━━━━━━━━━━━━━━━━━",
      "💡 <b>Tips</b>",
      "• Add multiple expenses in one message",
      "• Edit amount, category, or note before saving",
      "• Changes reflect instantly in your SplitKaro app",
    ].join("\n")
  );
}

async function handleRecent(chatId: number, userId: string): Promise<void> {
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
      chatId,
      "No expenses yet. Send me an expense to get started!"
    );
    return;
  }

  const lines = transactions.map((t, i) => {
    const date = new Date(t.transactionDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
    return `${i + 1}. ₹${t.amount} · ${getExpenseCategoryLabel(t.category)} · ${t.description} <i>(${date})</i>`;
  });

  await sendMessage(chatId, `📋 <b>Recent Expenses</b>\n\n${lines.join("\n")}`);
}

async function handleUnlink(chatId: number, userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { telegramChatId: null },
  });

  const redis = await ensureRedis();
  await Promise.all([
    redis.del(PENDING_KEY(chatId)),
    redis.del(AWAITING_KEY(chatId)),
  ]);

  await sendMessage(
    chatId,
    "✅ Your Telegram has been unlinked from SplitKaro.\n\nUse /start to link again."
  );
}

// ── Expense flow ──────────────────────────────────────────────────────────

async function handleTextExpense(chatId: number, text: string): Promise<void> {
  const redis = await ensureRedis();

  const expenses = await parseExpensesFromText(text);

  if (expenses.length === 0) {
    await sendMessage(
      chatId,
      "❓ I couldn't detect any expenses in your message.\n\nTry something like:\n• <code>lunch 200</code>\n• <code>paid 500 for groceries</code>"
    );
    return;
  }

  await redis.setEx(PENDING_KEY(chatId), PENDING_TTL, JSON.stringify(expenses));

  const { text: cardText, replyMarkup } = buildConfirmCard(expenses);
  await sendMessage(chatId, cardText, replyMarkup);
}

// ── Callback handlers ─────────────────────────────────────────────────────

async function handleSave(
  chatId: number,
  messageId: number,
  cbqId: string,
  userId: string
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(PENDING_KEY(chatId));

  if (!raw) {
    await answerCallbackQuery(cbqId, "Session expired. Resend your expenses.");
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

  // Invalidate cache for each unique month/year in the batch
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

  await redis.del(PENDING_KEY(chatId));

  const savedText =
    expenses.length === 1
      ? `✅ Saved: ₹${expenses[0].amount} · ${getExpenseCategoryLabel(expenses[0].category)} · ${expenses[0].description}`
      : `✅ Saved ${expenses.length} expenses`;

  await editMessageText(chatId, messageId, savedText);
  await answerCallbackQuery(cbqId);
}

async function handleCancel(
  chatId: number,
  messageId: number,
  cbqId: string
): Promise<void> {
  const redis = await ensureRedis();
  await Promise.all([
    redis.del(PENDING_KEY(chatId)),
    redis.del(AWAITING_KEY(chatId)),
  ]);
  await editMessageText(chatId, messageId, "❌ Cancelled.");
  await answerCallbackQuery(cbqId);
}

async function handleEdit(
  chatId: number,
  messageId: number,
  cbqId: string
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(PENDING_KEY(chatId));

  if (!raw) {
    await answerCallbackQuery(cbqId, "Session expired. Resend your expenses.");
    return;
  }

  const expenses = JSON.parse(raw) as ParsedExpense[];

  if (expenses.length === 1) {
    const e = expenses[0];
    await editMessageText(
      chatId,
      messageId,
      `✏️ <b>Edit Expense</b>\n\n₹${e.amount} · ${getExpenseCategoryLabel(e.category)} · ${e.description}\n\nWhat would you like to change?`,
      {
        inline_keyboard: [
          [
            { text: "💰 Amount", callback_data: "ef:0:a" },
            { text: "🏷️ Category", callback_data: "ef:0:c" },
          ],
          [
            { text: "📝 Note", callback_data: "ef:0:n" },
            { text: "← Back", callback_data: "back" },
          ],
        ],
      }
    );
  } else {
    const buttons = expenses.map((e, i) => [
      {
        text: `${i + 1}. ₹${e.amount} · ${e.description}`,
        callback_data: `ei:${i}`,
      },
    ]);
    buttons.push([{ text: "← Back", callback_data: "back" }]);

    await editMessageText(chatId, messageId, "✏️ Which expense to edit?", {
      inline_keyboard: buttons,
    });
  }

  await answerCallbackQuery(cbqId);
}

async function handleBack(
  chatId: number,
  messageId: number,
  cbqId: string
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(PENDING_KEY(chatId));
  await redis.del(AWAITING_KEY(chatId));

  if (!raw) {
    await answerCallbackQuery(cbqId, "Session expired. Resend your expenses.");
    return;
  }

  const expenses = JSON.parse(raw) as ParsedExpense[];
  const { text, replyMarkup } = buildConfirmCard(expenses);
  await editMessageText(chatId, messageId, text, replyMarkup);
  await answerCallbackQuery(cbqId);
}

async function handleEditExpenseSelect(
  chatId: number,
  messageId: number,
  cbqId: string,
  index: number
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(PENDING_KEY(chatId));

  if (!raw) {
    await answerCallbackQuery(cbqId, "Session expired. Resend your expenses.");
    return;
  }

  const expenses = JSON.parse(raw) as ParsedExpense[];
  const e = expenses[index];

  if (!e) {
    await answerCallbackQuery(cbqId, "Invalid selection.");
    return;
  }

  await editMessageText(
    chatId,
    messageId,
    `✏️ <b>Edit Expense ${index + 1}</b>\n\n₹${e.amount} · ${getExpenseCategoryLabel(e.category)} · ${e.description}\n\nWhat would you like to change?`,
    {
      inline_keyboard: [
        [
          { text: "💰 Amount", callback_data: `ef:${index}:a` },
          { text: "🏷️ Category", callback_data: `ef:${index}:c` },
        ],
        [
          { text: "📝 Note", callback_data: `ef:${index}:n` },
          { text: "← Back", callback_data: "edit" },
        ],
      ],
    }
  );

  await answerCallbackQuery(cbqId);
}

async function handleEditField(
  chatId: number,
  messageId: number,
  cbqId: string,
  index: number,
  field: string
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(PENDING_KEY(chatId));

  if (!raw) {
    await answerCallbackQuery(cbqId, "Session expired. Resend your expenses.");
    return;
  }

  if (field === "c") {
    // Show category picker
    const catRows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < EXPENSE_CATEGORIES.length; i += 2) {
      catRows.push(
        EXPENSE_CATEGORIES.slice(i, i + 2).map((cat) => ({
          text: cat.label,
          callback_data: `ec:${index}:${cat.value}`,
        }))
      );
    }
    catRows.push([{ text: "← Back", callback_data: `ei:${index}` }]);

    await editMessageText(chatId, messageId, "🏷️ Select a category:", {
      inline_keyboard: catRows,
    });
  } else {
    // Awaiting text input for amount ("a") or note ("n")
    const expenses = JSON.parse(raw) as ParsedExpense[];
    const e = expenses[index];
    const fieldLabel = field === "a" ? "amount (e.g. 250)" : "note/description";

    await redis.setEx(
      AWAITING_KEY(chatId),
      AWAITING_TTL,
      JSON.stringify({ index, field: field as "a" | "n", messageId } satisfies AwaitingState)
    );

    await editMessageText(
      chatId,
      messageId,
      `✏️ Send the new ${fieldLabel} for:\n<i>${e.description} · ₹${e.amount}</i>\n\nOr /cancel to go back.`
    );
  }

  await answerCallbackQuery(cbqId);
}

async function handleEditCategory(
  chatId: number,
  messageId: number,
  cbqId: string,
  index: number,
  category: string
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(PENDING_KEY(chatId));

  if (!raw) {
    await answerCallbackQuery(cbqId, "Session expired. Resend your expenses.");
    return;
  }

  const expenses = JSON.parse(raw) as ParsedExpense[];

  if (!expenses[index]) {
    await answerCallbackQuery(cbqId, "Invalid selection.");
    return;
  }

  expenses[index].category = category;
  await redis.setEx(PENDING_KEY(chatId), PENDING_TTL, JSON.stringify(expenses));

  const { text, replyMarkup } = buildConfirmCard(expenses);
  await editMessageText(chatId, messageId, text, replyMarkup);
  await answerCallbackQuery(cbqId, "Category updated!");
}

async function handleAwaitingInput(
  chatId: number,
  text: string,
  state: AwaitingState
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(PENDING_KEY(chatId));

  if (!raw) {
    await sendMessage(chatId, "Session expired. Please resend your expenses.");
    await redis.del(AWAITING_KEY(chatId));
    return;
  }

  const expenses = JSON.parse(raw) as ParsedExpense[];
  const { index, field, messageId } = state;

  if (field === "a") {
    const amount = parseFloat(text.replace(/[^\d.]/g, ""));
    if (isNaN(amount) || amount <= 0) {
      await sendMessage(
        chatId,
        "❌ Invalid amount. Send a valid number (e.g. 250):"
      );
      return;
    }
    expenses[index].amount = amount;
  } else {
    if (!text.trim()) {
      await sendMessage(chatId, "❌ Note can't be empty. Send a description:");
      return;
    }
    expenses[index].description = text.trim();
  }

  await redis.setEx(PENDING_KEY(chatId), PENDING_TTL, JSON.stringify(expenses));
  await redis.del(AWAITING_KEY(chatId));

  const { text: cardText, replyMarkup } = buildConfirmCard(expenses);

  // Try editing the original message; fall back to a new message if it's gone
  try {
    await editMessageText(chatId, messageId, cardText, replyMarkup);
  } catch {
    await sendMessage(chatId, cardText, replyMarkup);
  }
}

// ── Group expense helpers & handlers ─────────────────────────────────────

function buildGroupConfirmCard(pending: GroupExpensePending): {
  text: string;
  replyMarkup: object;
} {
  const splitCount = pending.selectedMemberIds?.length ?? pending.memberCount;
  const perPerson = (pending.expense.amount / splitCount).toFixed(2);

  const text = [
    "📝 <b>Group Expense</b>",
    "",
    `Amount   : ₹${pending.expense.amount}`,
    `Note     : ${pending.expense.description}`,
    `Category : ${getExpenseCategoryLabel(pending.expense.category)}`,
    `Group    : ${pending.groupName}`,
    `Paid by  : You`,
    `Split    : Equal (${splitCount} members) → ₹${perPerson} each`,
  ].join("\n");

  return {
    text,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "✅ Save", callback_data: "gsave" },
          { text: "👥 Change Split", callback_data: "gchsplit" },
          { text: "❌ Cancel", callback_data: "gcancel" },
        ],
      ],
    },
  };
}

function buildMemberButtons(
  members: GroupMember[],
  selected: string[]
): Array<Array<{ text: string; callback_data: string }>> {
  const selectedSet = new Set(selected);
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  for (let i = 0; i < members.length; i += 2) {
    rows.push(
      members.slice(i, i + 2).map((m) => ({
        text: `${selectedSet.has(m.id) ? "✅" : "❌"} ${m.name}`,
        callback_data: `gm:${m.id}`,
      }))
    );
  }

  rows.push([
    { text: `✅ Done (${selected.length} selected)`, callback_data: "gmdone" },
  ]);

  return rows;
}

async function getUserGroups(userId: string) {
  return prisma.group.findMany({
    where: { members: { some: { userId } }, isArchived: false },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
}

async function showGroupSelection(
  chatId: number,
  groups: Array<{ id: string; name: string }>
): Promise<void> {
  const buttons = groups.map((g) => [
    { text: g.name, callback_data: `gs:${g.id}` },
  ]);
  await sendMessage(chatId, "👥 Which group?", { inline_keyboard: buttons });
}

async function handleGroupCommand(
  chatId: number,
  userId: string,
  expenseText: string
): Promise<void> {
  const redis = await ensureRedis();
  const groups = await getUserGroups(userId);

  if (groups.length === 0) {
    await sendMessage(
      chatId,
      "You're not part of any group yet. Create or join a group in the SplitKaro app first."
    );
    return;
  }

  if (!expenseText.trim()) {
    await redis.setEx(GAWAITING_KEY(chatId), AWAITING_TTL, "1");
    await sendMessage(
      chatId,
      "What's the expense?\n\nSend it like: <code>dinner 500</code>"
    );
    return;
  }

  const expenses = await parseExpensesFromText(expenseText);
  if (expenses.length === 0) {
    await sendMessage(
      chatId,
      "❓ Couldn't detect an expense. Try: <code>/group dinner 500</code>"
    );
    return;
  }

  // Group expenses are single — take the first parsed item
  const expense = expenses[0];
  await redis.setEx(GEXPENSE_KEY(chatId), GEXPENSE_TTL, JSON.stringify(expense));
  await showGroupSelection(chatId, groups);
}

async function handleGroupSelect(
  chatId: number,
  messageId: number,
  cbqId: string,
  userId: string,
  groupId: string
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(GEXPENSE_KEY(chatId));

  if (!raw) {
    await answerCallbackQuery(cbqId, "Session expired. Use /group again.");
    return;
  }

  const expense = JSON.parse(raw) as ParsedExpense;

  const group = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId } } },
    select: { id: true, name: true, _count: { select: { members: true } } },
  });

  if (!group) {
    await answerCallbackQuery(cbqId, "Group not found.");
    return;
  }

  const pending: GroupExpensePending = {
    expense,
    groupId: group.id,
    groupName: group.name,
    memberCount: group._count.members,
  };

  await redis.setEx(GPENDING_KEY(chatId), GEXPENSE_TTL, JSON.stringify(pending));
  await redis.del(GEXPENSE_KEY(chatId));

  const { text, replyMarkup } = buildGroupConfirmCard(pending);
  await editMessageText(chatId, messageId, text, replyMarkup);

  await answerCallbackQuery(cbqId);
}

async function handleGroupSave(
  chatId: number,
  messageId: number,
  cbqId: string,
  userId: string
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(GPENDING_KEY(chatId));

  if (!raw) {
    await answerCallbackQuery(cbqId, "Session expired. Use /group again.");
    return;
  }

  const pending = JSON.parse(raw) as GroupExpensePending;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  if (!user) {
    await answerCallbackQuery(cbqId, "User not found.");
    return;
  }

  // Build explicit splits when a subset of members is selected
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
  await redis.del(GPENDING_KEY(chatId));

  await editMessageText(
    chatId,
    messageId,
    `✅ Saved to <b>${pending.groupName}</b>: ₹${pending.expense.amount} · ${pending.expense.description}`
  );
  await answerCallbackQuery(cbqId);
}

async function handleChangeSplit(
  chatId: number,
  messageId: number,
  cbqId: string,
  userId: string
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(GPENDING_KEY(chatId));

  if (!raw) {
    await answerCallbackQuery(cbqId, "Session expired. Use /group again.");
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

  // Use existing selection or default to all members
  const selected = pending.selectedMemberIds ?? members.map((m) => m.id);

  const selState: MemberSelectionState = { members, selected };
  await redis.setEx(GSEL_KEY(chatId), GEXPENSE_TTL, JSON.stringify(selState));

  await editMessageText(
    chatId,
    messageId,
    "👥 <b>Select who to split with:</b>\n\nTap a name to toggle:",
    { inline_keyboard: buildMemberButtons(members, selected) }
  );

  await answerCallbackQuery(cbqId);
}

async function handleToggleMember(
  chatId: number,
  messageId: number,
  cbqId: string,
  memberId: string
): Promise<void> {
  const redis = await ensureRedis();
  const raw = await redis.get(GSEL_KEY(chatId));

  if (!raw) {
    await answerCallbackQuery(cbqId, "Session expired. Use /group again.");
    return;
  }

  const selState = JSON.parse(raw) as MemberSelectionState;
  const selectedSet = new Set(selState.selected);

  if (selectedSet.has(memberId)) {
    // Prevent removing the last selected member
    if (selectedSet.size <= 1) {
      await answerCallbackQuery(cbqId, "At least one member must be selected.");
      return;
    }
    selectedSet.delete(memberId);
  } else {
    selectedSet.add(memberId);
  }

  selState.selected = [...selectedSet];
  await redis.setEx(GSEL_KEY(chatId), GEXPENSE_TTL, JSON.stringify(selState));

  await editMessageText(
    chatId,
    messageId,
    "👥 <b>Select who to split with:</b>\n\nTap a name to toggle:",
    { inline_keyboard: buildMemberButtons(selState.members, selState.selected) }
  );

  await answerCallbackQuery(cbqId);
}

async function handleMembersDone(
  chatId: number,
  messageId: number,
  cbqId: string
): Promise<void> {
  const redis = await ensureRedis();
  const [selRaw, pendingRaw] = await Promise.all([
    redis.get(GSEL_KEY(chatId)),
    redis.get(GPENDING_KEY(chatId)),
  ]);

  if (!selRaw || !pendingRaw) {
    await answerCallbackQuery(cbqId, "Session expired. Use /group again.");
    return;
  }

  const selState = JSON.parse(selRaw) as MemberSelectionState;
  const pending = JSON.parse(pendingRaw) as GroupExpensePending;

  pending.selectedMemberIds = selState.selected;

  await redis.setEx(GPENDING_KEY(chatId), GEXPENSE_TTL, JSON.stringify(pending));
  await redis.del(GSEL_KEY(chatId));

  const { text, replyMarkup } = buildGroupConfirmCard(pending);
  await editMessageText(chatId, messageId, text, replyMarkup);
  await answerCallbackQuery(cbqId);
}

async function handleGroupCancel(
  chatId: number,
  messageId: number,
  cbqId: string
): Promise<void> {
  const redis = await ensureRedis();
  await Promise.all([
    redis.del(GEXPENSE_KEY(chatId)),
    redis.del(GPENDING_KEY(chatId)),
    redis.del(GAWAITING_KEY(chatId)),
    redis.del(GSEL_KEY(chatId)),
  ]);
  await editMessageText(chatId, messageId, "❌ Cancelled.");
  await answerCallbackQuery(cbqId);
}

// ── Message router ────────────────────────────────────────────────────────

async function processMessage(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const text = message.text ?? "";
  const firstName = message.from.first_name;

  if (text.startsWith("/")) {
    // Strip bot username suffix (e.g. /start@SplitKaroBot → /start)
    const command = text.split(" ")[0].toLowerCase().replace(/@\w+$/, "");

    if (command === "/start") {
      await handleStart(chatId, firstName);
      return;
    }

    if (command === "/help") {
      await handleHelp(chatId);
      return;
    }

    if (command === "/cancel") {
      const redis = await ensureRedis();
      await Promise.all([
        redis.del(PENDING_KEY(chatId)),
        redis.del(AWAITING_KEY(chatId)),
      ]);
      await sendMessage(chatId, "Cancelled.");
      return;
    }

    // Auth-required commands
    const user = await getUserByChat(chatId);
    if (!user) {
      await sendMessage(
        chatId,
        "⚠️ Your Telegram is not linked to SplitKaro.\n\nUse /start to link your account."
      );
      return;
    }

    if (command === "/recent") await handleRecent(chatId, user.id);
    else if (command === "/unlink") await handleUnlink(chatId, user.id);
    else if (command === "/group") {
      const expenseText = text.slice(text.indexOf(" ") + 1).trim();
      // If "/group" with no args, indexOf returns -1, slice(0) gives full string — guard it
      const cleanText = expenseText === text.trim() ? "" : expenseText;
      await handleGroupCommand(chatId, user.id, cleanText);
    } else await handleHelp(chatId);

    return;
  }

  // Non-command text — requires auth
  const user = await getUserByChat(chatId);
  if (!user) {
    await sendMessage(
      chatId,
      "⚠️ Your Telegram is not linked to SplitKaro.\n\nUse /start to link your account."
    );
    return;
  }

  const redis = await ensureRedis();

  // Check if awaiting a typed value for a personal expense edit
  const awaitingRaw = await redis.get(AWAITING_KEY(chatId));
  if (awaitingRaw) {
    const state = JSON.parse(awaitingRaw) as AwaitingState;
    await handleAwaitingInput(chatId, text, state);
    return;
  }

  // Check if awaiting expense text for the /group flow
  const gawaitingRaw = await redis.get(GAWAITING_KEY(chatId));
  if (gawaitingRaw) {
    await redis.del(GAWAITING_KEY(chatId));
    const groups = await getUserGroups(user.id);
    const expenses = await parseExpensesFromText(text);
    if (expenses.length === 0) {
      await sendMessage(
        chatId,
        "❓ Couldn't detect an expense. Try: <code>dinner 500</code>"
      );
      return;
    }
    await redis.setEx(GEXPENSE_KEY(chatId), GEXPENSE_TTL, JSON.stringify(expenses[0]));
    await showGroupSelection(chatId, groups);
    return;
  }

  await handleTextExpense(chatId, text);
}

async function processCallbackQuery(cq: TelegramCallbackQuery): Promise<void> {
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const cbqId = cq.id;
  const data = cq.data;

  const user = await getUserByChat(chatId);
  if (!user) {
    await answerCallbackQuery(cbqId, "Account not linked. Use /start.");
    return;
  }

  if (data === "save") {
    await handleSave(chatId, messageId, cbqId, user.id);
  } else if (data === "cancel") {
    await handleCancel(chatId, messageId, cbqId);
  } else if (data === "edit") {
    await handleEdit(chatId, messageId, cbqId);
  } else if (data === "back") {
    await handleBack(chatId, messageId, cbqId);
  } else if (data.startsWith("ei:")) {
    await handleEditExpenseSelect(
      chatId,
      messageId,
      cbqId,
      parseInt(data.slice(3), 10)
    );
  } else if (data.startsWith("ef:")) {
    const [, idx, field] = data.split(":");
    await handleEditField(chatId, messageId, cbqId, parseInt(idx, 10), field);
  } else if (data.startsWith("ec:")) {
    const [, idx, category] = data.split(":");
    await handleEditCategory(
      chatId,
      messageId,
      cbqId,
      parseInt(idx, 10),
      category
    );
  } else if (data.startsWith("gs:")) {
    await handleGroupSelect(chatId, messageId, cbqId, user.id, data.slice(3));
  } else if (data === "gsave") {
    await handleGroupSave(chatId, messageId, cbqId, user.id);
  } else if (data === "gcancel") {
    await handleGroupCancel(chatId, messageId, cbqId);
  } else if (data === "gchsplit") {
    await handleChangeSplit(chatId, messageId, cbqId, user.id);
  } else if (data.startsWith("gm:")) {
    await handleToggleMember(chatId, messageId, cbqId, data.slice(3));
  } else if (data === "gmdone") {
    await handleMembersDone(chatId, messageId, cbqId);
  }
}

async function processUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    await processCallbackQuery(update.callback_query);
  } else if (update.message?.text) {
    await processMessage(update.message);
  }
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Process synchronously — Telegram allows up to 60s for webhook responses
  try {
    await processUpdate(update);
  } catch {
    // Swallow errors so Telegram doesn't retry endlessly
  }

  return NextResponse.json({ ok: true });
}
