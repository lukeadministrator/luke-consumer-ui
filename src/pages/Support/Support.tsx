import { useState } from "react";
import { useUser } from "../../context/AuthContext";
import PageMeta from "../../components/common/PageMeta";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";

const SUPPORT_EMAIL = "support@lukeflow.com";

export default function Support() {
  const { user } = useUser();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const from = user?.email ?? "";

  function handleSend() {
    const body = `${message}\n\n—\nFrom: ${from}`;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject || "Lukeflow support",
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <>
      <PageMeta title="Support | Lukeflow" description="Get help with Lukeflow." />

      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">Support</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            We're here to help. Send us a message and we'll get back to you.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex flex-col gap-5">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="How can we help?"
                />
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <textarea
                  id="message"
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or question…"
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                />
              </div>
              <div>
                <Button size="sm" disabled={!message.trim()} onClick={handleSend}>
                  Send message
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">
              Other ways to reach us
            </h2>
            <dl className="flex flex-col gap-4 text-sm">
              <div>
                <dt className="text-gray-400">Email</dt>
                <dd>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-500 hover:underline">
                    {SUPPORT_EMAIL}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-gray-400">Response time</dt>
                <dd className="text-gray-700 dark:text-gray-300">Within 1 business day</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
