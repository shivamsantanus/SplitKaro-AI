import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ShareExpenseClient } from "./ShareExpenseClient";

interface Props {
  searchParams: Promise<{ text?: string; title?: string; url?: string }>;
}

export default async function ShareExpensePage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    const query = new URLSearchParams();
    if (params.text) query.set("text", params.text);
    if (params.title) query.set("title", params.title);
    if (params.url) query.set("url", params.url);
    const qs = query.toString();
    const callbackUrl = `/share-expense${qs ? `?${qs}` : ""}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  // Some senders only populate title or url instead of text — fall back so nothing gets dropped.
  const sharedText = params.text || params.title || params.url || "";

  return <ShareExpenseClient initialText={sharedText} />;
}
