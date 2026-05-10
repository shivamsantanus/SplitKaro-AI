import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ensureRedis } from "@/lib/redis";
import prisma from "@/lib/prisma";
import { sendMessage } from "@/lib/telegram-bot";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function LinkTelegramPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { token } = await searchParams;

  if (!token) {
    return (
      <ResultPage
        ok={false}
        message="Invalid link. Use /start in the SplitKaro Telegram bot to get a new link."
      />
    );
  }

  const redis = await ensureRedis();
  const raw = await redis.get(`tg:link:${token}`);

  if (!raw) {
    return (
      <ResultPage
        ok={false}
        message="This link has expired or already been used. Use /start in the bot to get a new one."
      />
    );
  }

  const { chatId } = JSON.parse(raw) as { chatId: string };

  // Prevent one Telegram account from being linked to multiple SplitKaro accounts
  const existing = await prisma.user.findUnique({
    where: { telegramChatId: chatId },
    select: { id: true },
  });

  if (existing && existing.id !== session.user.id) {
    return (
      <ResultPage
        ok={false}
        message="This Telegram account is already linked to another SplitKaro account."
      />
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { telegramChatId: chatId },
  });

  // Consume the token so it can't be reused
  await redis.del(`tg:link:${token}`);

  const name = session.user.name ?? "there";

  await sendMessage(
    chatId,
    `✅ <b>Account linked!</b>\n\nHello, ${name}! You can now add expenses directly from Telegram.\n\nTry it:\n• <code>lunch 200</code>\n• <code>coffee 80, metro 30</code>`
  );

  return <ResultPage ok name={name} />;
}

function ResultPage({
  ok,
  name,
  message,
}: {
  ok: boolean;
  name?: string;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center gap-4">
      <span className="text-6xl">{ok ? "✅" : "❌"}</span>
      <h1 className="text-2xl font-bold">
        {ok ? "Account Linked!" : "Link Failed"}
      </h1>
      <p className="text-muted-foreground max-w-sm">
        {ok
          ? `Hey ${name}! Your Telegram is now linked to SplitKaro. Go back to Telegram and start adding expenses!`
          : message}
      </p>
    </div>
  );
}
