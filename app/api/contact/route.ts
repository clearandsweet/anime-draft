import { NextRequest, NextResponse } from "next/server";

const CONTACT_TO_EMAIL = "Kairandersen@gmail.com";

function normalize(value: unknown, maxLen: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toPlainText(payload: { name: string; email: string; subject: string; message: string }) {
  return [
    "New contact form message",
    "",
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Subject: ${payload.subject}`,
    "",
    "Message:",
    payload.message,
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    return NextResponse.json(
      { error: "Contact form is not configured yet. Missing email service settings." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = normalize((body as Record<string, unknown>)?.name, 120);
  const email = normalize((body as Record<string, unknown>)?.email, 200);
  const subject = normalize((body as Record<string, unknown>)?.subject, 180);
  const message = normalize((body as Record<string, unknown>)?.message, 4000);

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: "Message is too short." }, { status: 400 });
  }

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [CONTACT_TO_EMAIL],
      reply_to: email,
      subject: `[godisaloli.com] ${subject}`,
      text: toPlainText({ name, email, subject, message }),
    }),
  });

  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => "");
    return NextResponse.json(
      {
        error: "Could not deliver the message right now.",
        detail: detail.slice(0, 500),
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}

