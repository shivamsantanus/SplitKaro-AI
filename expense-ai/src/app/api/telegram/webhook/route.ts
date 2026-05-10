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
      `Welcome back, ${user.name ?? firstName}! 👋\n\nYou're already linked. Just send me your expenses!\n\nExamples:\n• <code>lunch 200</code>\n• <code>coffee 80, metro 30, groceries 500</code>`
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
    `👋 Welcome to <b>SplitKaro</b>!\n\nTap the button below to link your account.\nThe link expires in <b>15 minutes</b>.`,
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
      "📖 <b>SplitKaro Bot Help</b>",
      "",
      "Just send your expenses naturally:",
      "• <code>lunch 200</code>",
      "• <code>paid 500 for groceries</code>",
      "• <code>lunch 200, coffee 50, metro 30</code>",
      "",
      "<b>Commands:</b>",
      "/start — link your account",
      "/recent — last 5 expenses",
      "/unlink — unlink this Telegram",
      "/cancel — cancel current action",
      "/help — show this message",
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
    else await handleHelp(chatId);

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

  // Check if we're awaiting a typed value for an edit
  const redis = await ensureRedis();
  const awaitingRaw = await redis.get(AWAITING_KEY(chatId));

  if (awaitingRaw) {
    const state = JSON.parse(awaitingRaw) as AwaitingState;
    await handleAwaitingInput(chatId, text, state);
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
