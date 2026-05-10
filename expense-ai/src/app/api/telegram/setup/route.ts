import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// One-time route to register the webhook with Telegram.
// Call it once after deployment: GET /api/telegram/setup?secret=<BOT_TOKEN>
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = new URL(req.url).searchParams.get("secret");

  if (!secret || secret !== process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookSecret = crypto
    .createHash("sha256")
    .update(process.env.TELEGRAM_BOT_TOKEN ?? "")
    .digest("hex")
    .slice(0, 32);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://splitkaro.tristech.in";

  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: `${appUrl}/api/telegram/webhook`,
        secret_token: webhookSecret,
        allowed_updates: ["message", "callback_query"],
      }),
    }
  );

  const data = await res.json();
  return NextResponse.json(data);
}
