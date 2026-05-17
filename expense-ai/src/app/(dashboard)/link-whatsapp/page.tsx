import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ensureRedis } from "@/lib/redis";
import prisma from "@/lib/prisma";
import { sendMessage } from "@/lib/whatsapp-bot";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function LinkWhatsAppPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { token } = await searchParams;

  if (!token) {
    return (
      <ResultPage
        ok={false}
        message="Invalid link. Send /start in the SplitKaro WhatsApp bot to get a new link."
      />
    );
  }

  const redis = await ensureRedis();
  const raw = await redis.get(`wa:link:${token}`);

  if (!raw) {
    return (
      <ResultPage
        ok={false}
        message="This link has expired or already been used. Send /start in the bot to get a new one."
      />
    );
  }

  const { phone } = JSON.parse(raw) as { phone: string };

  // Prevent one WhatsApp number from linking to multiple SplitKaro accounts
  const existing = await prisma.user.findUnique({
    where: { whatsappPhone: phone },
    select: { id: true },
  });

  if (existing && existing.id !== session.user.id) {
    return (
      <ResultPage
        ok={false}
        message="This WhatsApp number is already linked to another SplitKaro account."
      />
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { whatsappPhone: phone },
  });

  // Consume the token so it can't be reused
  await redis.del(`wa:link:${token}`);

  const name = session.user.name ?? "there";

  await sendMessage(
    phone,
    `✅ *Account linked!*\n\nHello, ${name}! You can now add expenses directly from WhatsApp.\n\nTry it:\n• lunch 200\n• coffee 80, metro 30`
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
        {ok ? "WhatsApp Linked!" : "Link Failed"}
      </h1>
      <p className="text-muted-foreground max-w-sm">
        {ok
          ? `Hey ${name}! Your WhatsApp is now linked to SplitKaro. Go back to WhatsApp and start adding expenses!`
          : message}
      </p>
    </div>
  );
}
