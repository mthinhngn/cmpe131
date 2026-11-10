import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";

type Delivery = { mode: "log"; origin: URL } | { mode: "resend"; origin: URL; apiKey: string; recipient: string };

export function deliverySettings(): Delivery {
  const mode = process.env.AUTH_DELIVERY;
  if (process.env.NODE_ENV === "production" || !["log", "resend"].includes(mode || "")) {
    throw new ServiceUnavailableException("Local email sign-in delivery is not configured.");
  }
  let origin: URL;
  try { origin = new URL(process.env.AUTH_WEB_ORIGIN || "http://localhost:5175"); }
  catch { throw new ServiceUnavailableException("Sign-in return address is not configured correctly."); }
  if (!["http:", "https:"].includes(origin.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) || origin.username || origin.password) {
    throw new ServiceUnavailableException("This sign-in setup requires a localhost return address.");
  }
  if (mode === "log") return { mode, origin };
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipient = process.env.AUTH_TEST_EMAIL?.trim().toLowerCase();
  if (!apiKey || !recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new ServiceUnavailableException("Email sign-in is not configured. Set the Resend API key and test inbox in the local API settings.");
  }
  return { mode: "resend", origin, apiKey, recipient };
}

export function validateRecipient(settings: Delivery, email: string) {
  if (settings.mode === "resend" && email !== settings.recipient) {
    throw new BadRequestException("Email sign-in is currently limited to the inbox used for this project's Resend account.");
  }
}

// Native fetch keeps the provider integration server-only without another SDK.
export async function sendSignInEmail(settings: Extract<Delivery, { mode: "resend" }>, email: string, url: URL) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Course Radar <onboarding@resend.dev>",
        to: [email],
        subject: "Your Course Radar sign-in link",
        text: `Sign in to Course Radar:\n\n${url.href}\n\nThis link expires in 15 minutes and can be used once. Open it on the computer running Course Radar locally. If you did not request this link, ignore this email.`,
      }),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    // Never forward provider response bodies: they may contain private details.
    if (!response.ok) throw new Error("Provider rejected delivery");
    const result = await response.json() as { id?: unknown };
    if (typeof result.id !== "string" || !result.id) throw new Error("Provider did not acknowledge delivery");
  } catch {
    throw new ServiceUnavailableException("The sign-in email could not be confirmed. Please request a new link. If this continues, check the Resend key, test inbox and sending limits.");
  }
}
