const BASE = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}`;

async function call(body: object): Promise<void> {
  await fetch(`${BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
}

export async function sendMessage(to: string, text: string): Promise<void> {
  await call({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

export interface ButtonOption {
  id: string;
  title: string;
}

export async function sendButtons(
  to: string,
  bodyText: string,
  buttons: ButtonOption[]
): Promise<void> {
  await call({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export async function sendList(
  to: string,
  bodyText: string,
  buttonLabel: string,
  rows: ListRow[]
): Promise<void> {
  await call({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: [
          {
            title: "Options",
            rows: rows.slice(0, 10).map((r) => ({
              id: r.id,
              title: r.title.slice(0, 24),
              ...(r.description ? { description: r.description.slice(0, 72) } : {}),
            })),
          },
        ],
      },
    },
  });
}

export async function markAsRead(messageId: string): Promise<void> {
  await call({
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}
