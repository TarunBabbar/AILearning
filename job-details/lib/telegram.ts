// One-way Telegram delivery for owner notifications (chat widget → owner).
// Server-only: reads TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID from the
// environment. The chat id (Tarun's Telegram) is never exposed to the client.

const TELEGRAM_API = "https://api.telegram.org";

export type TelegramResult = { ok: boolean; error?: string };

export async function sendTelegramMessage(text: string): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    return { ok: false, error: "Telegram not configured." };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Telegram API error ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Telegram send failed." };
  }
}
