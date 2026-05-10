import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually
const envPath = resolve(process.cwd(), ".env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
const APP_URL = env.NEXT_PUBLIC_APP_URL ?? "https://splitkaro.tristech.in";

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN not found in .env");
  process.exit(1);
}

const webhookSecret = createHash("sha256")
  .update(BOT_TOKEN)
  .digest("hex")
  .slice(0, 32);

const webhookUrl = `${APP_URL}/api/telegram/webhook`;

console.log(`Setting webhook to: ${webhookUrl}`);

const res = await fetch(
  `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message", "callback_query"],
    }),
  }
);

const data = await res.json();

if (data.ok) {
  console.log("✅ Webhook registered successfully!");
} else {
  console.error("❌ Failed:", data.description);
}
