import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = { title: "Delete your account — EchoToCrowd" };

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen px-6 pb-24">
      <header className="max-w-3xl mx-auto py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-signal-400">
          <img src="/echotocrowd-favicon.png" alt="EchoToCrowd logo" className="h-10 w-10 rounded-md" />
          <span className="font-display text-xl font-bold tracking-tight">ECHOTOCROWD</span>
        </Link>
        <Link href="/" className="text-parchment-500 hover:text-parchment-100 text-sm transition-colors">
          Back home
        </Link>
      </header>

      <article className="max-w-3xl mx-auto">
        <h1 className="font-display text-3xl font-bold mb-2">Delete your account</h1>
        <p className="text-parchment-500 text-sm mb-10">Last updated: September 9, 2026</p>

        <div className="space-y-8 text-parchment-300 leading-relaxed">
          <Section title="Delete from the app">
            <p>
              If you have EchoToCrowd installed, open <strong className="text-parchment-100">Profile</strong>,
              then tap <strong className="text-parchment-100">Delete account</strong>. You will be asked to
              confirm. This uses Google sign-in only — there is no password to enter.
            </p>
          </Section>

          <Section title="Request deletion by email">
            <p>
              If you no longer have the app, email{" "}
              <a href="mailto:privacy@echotocrowd.com" className="text-signal-400 hover:text-signal-300">
                privacy@echotocrowd.com
              </a>{" "}
              from the Google account you used to sign in and ask us to delete your EchoToCrowd
              account.
            </p>
          </Section>

          <Section title="What we delete">
            <p>When an account is deleted, we remove:</p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li>Your profile (name, username, location, date of birth, school verification, tags)</li>
              <li>Your Google sign-in link, so that identity can no longer access EchoToCrowd</li>
              <li>Echoes you posted, including replies other people left on those echoes</li>
              <li>Your private 1:1 conversations and the messages in them</li>
              <li>Messages you sent in groups, plus your membership in those groups</li>
              <li>Uploads you added (profile photo and echo attachments), including the stored files</li>
              <li>Blocks, hides, reports you filed, and notifications involving your account</li>
            </ul>
          </Section>

          <Section title="What stays">
            <p>
              Groups you created remain for any remaining members. Group ownership is passed to
              another member. Shared link-preview records (URLs fetched for anyone) are not
              personal account data and are not removed. Reports other people filed about you are
              deleted with your account.
            </p>
          </Section>
        </div>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-parchment-100 mb-2">{title}</h2>
      {children}
    </section>
  );
}
