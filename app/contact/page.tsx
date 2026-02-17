"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<SubmitState>("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setError(typeof data.error === "string" ? data.error : "Could not send your message.");
        return;
      }
      setStatus("success");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
      setError("Could not send your message.");
    }
  }

  return (
    <main className="site-page-v2">
      <section className="v2-section v2-contact-wrap">
        <article className="v2-panel v2-contact-panel">
          <p className="v2-kicker">Contact</p>
          <h1 className="v2-contact-title">Send a Message</h1>
          <p className="v2-contact-copy">
            Use the form below for business inquiries, panel requests, and collaboration opportunities.
          </p>

          <form onSubmit={onSubmit} className="v2-contact-form">
            <label>
              Name
              <input
                className="v2-search"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </label>

            <label>
              Email
              <input
                type="email"
                className="v2-search"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={200}
              />
            </label>

            <label>
              Subject
              <input
                className="v2-search"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                maxLength={180}
              />
            </label>

            <label>
              Message
              <textarea
                className="v2-contact-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                minLength={10}
                maxLength={4000}
              />
            </label>

            <button type="submit" className="v2-btn primary" disabled={status === "submitting"}>
              {status === "submitting" ? "Sending..." : "Send Message"}
            </button>

            {status === "success" ? <p className="v2-contact-ok">Message sent.</p> : null}
            {status === "error" ? <p className="v2-contact-error">{error}</p> : null}
          </form>

          <div className="v2-contact-back">
            <Link href="/" className="v2-btn ghost">
              Back to Home
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}

