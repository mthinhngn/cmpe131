import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";

type Delivery = { mode: "log"; origin: URL } | { mode: "resend"; origin: URL; apiKey: string; recipient?: string; from?: string };

export function deliverySettings(): Delivery {
  const mode = process.env.AUTH_DELIVERY;
  const production = process.env.NODE_ENV === "production";
  if (!["log", "resend"].includes(mode || "") || (production && mode !== "resend")) {
    throw new ServiceUnavailableException("Email sign-in delivery is not configured.");
  }
  let origin: URL;
  try { origin = new URL(process.env.AUTH_WEB_ORIGIN || "http://localhost:5175"); }
  catch { throw new ServiceUnavailableException("Sign-in return address is not configured correctly."); }
  const localhost = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      (production ? origin.protocol !== "https:" || localhost || !(process.env.WEB_ORIGIN || "").split(",").includes(origin.origin) : !localhost || !["http:", "https:"].includes(origin.protocol))) {
    throw new ServiceUnavailableException(production ? "Sign-in requires an approved HTTPS return address." : "This sign-in setup requires a localhost return address.");
  }
  if (mode === "log") return { mode, origin };
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipient = process.env.AUTH_TEST_EMAIL?.trim().toLowerCase();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || (!from && !recipient) || (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) ||
      (from && (!/^[^<>\r\n]*<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/.test(from) || /@resend\.dev>$/i.test(from)))) {
    throw new ServiceUnavailableException("Email sign-in is not configured. Set the Resend key and a verified sender or test inbox.");
  }
  return { mode: "resend", origin, apiKey, recipient, from };
}

export function validateRecipient(settings: Delivery, email: string) {
  if (settings.mode === "resend" && settings.recipient && email !== settings.recipient) {
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
        from: settings.from || "Course Radar <onboarding@resend.dev>",
        to: [email],
        subject: "Your Course Radar sign-in link",
        text: `Sign in to Course Radar:\n\n${url.href}\n\nThis link expires in 15 minutes and can be used once. If you did not request this link, ignore this email.`,
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
