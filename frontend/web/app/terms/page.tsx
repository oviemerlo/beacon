import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = { title: "Terms of Service — EchoToCrowd" };

export default function TermsPage() {
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
        <h1 className="font-display text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-parchment-500 text-sm mb-10">Last updated: August 30, 2026</p>

        <div className="space-y-8 text-parchment-300 leading-relaxed">
          <Section title="Agreement to these terms">
            <p>
              These Terms of Service ("Terms") govern your use of EchoToCrowd, operated by
              1001721403 Ontario Inc. ("EchoToCrowd," "we," "us"). By creating an account or
              using EchoToCrowd, you agree to these Terms.
            </p>
          </Section>

          <Section title="Minimum age">
            <p>
              You must be at least 16 years old to use EchoToCrowd. By creating an account, you
              confirm that you meet this requirement. We rely on the birthdate you provide — we
              do not independently verify age beyond this — and reserve the right to suspend or
              terminate any account we determine does not meet this requirement.
            </p>
          </Section>

          <Section title="Your account">
            <ul className="list-disc pl-5 space-y-1">
              <li>You're responsible for the activity on your account.</li>
              <li>You must provide accurate information, including your date of birth.</li>
              <li>You may not create an account for anyone other than yourself, or on behalf of someone who doesn't meet our minimum age requirement.</li>
              <li>You may not maintain more than one active account without our permission.</li>
            </ul>
          </Section>

          <Section title="Community guidelines">
            <p>You agree not to use EchoToCrowd to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Post content that is illegal, harassing, hateful, sexually explicit, or violent.</li>
              <li>Impersonate another person or misrepresent your affiliation with any person or entity.</li>
              <li>Send unsolicited commercial messages outside of an approved business tier.</li>
              <li>Attempt to access another user's account or interfere with the operation of the service.</li>
              <li>Upload content that infringes someone else's intellectual property or privacy rights.</li>
            </ul>
            <p className="mt-2">
              We use a combination of automated tools (including AWS Rekognition and OpenAI's
              moderation tooling) and human review to enforce these guidelines. Violating them
              may result in content removal, account suspension, or termination, at our
              discretion, with or without notice depending on severity.
            </p>
          </Section>

          <Section title="Content you post">
            <p>
              You retain ownership of the content you post. By posting content on EchoToCrowd,
              you grant us a license to host, display, and distribute that content within the
              app as necessary to operate the service. You're solely responsible for what you
              post.
            </p>
          </Section>

          <Section title="Subscriptions and payment">
            <p>
              EchoToCrowd offers paid subscription tiers. By subscribing, you authorize us
              (through our payment processor, Stripe) to charge your chosen payment method on a
              recurring basis until you cancel. Prices and included features for each tier are
              shown in the app at the time of purchase and may change with notice. You can
              cancel your subscription at any time; cancellation takes effect at the end of your
              current billing period, and we do not provide refunds for partial periods except
              where required by law.
            </p>
            <p className="mt-2">
              Some tiers require identity verification through Stripe Identity as a condition of
              subscribing. If your submitted identity information cannot be verified, we may
              decline or downgrade your subscription.
            </p>
          </Section>

          <Section title="Location accuracy">
            <p>
              EchoToCrowd's core features depend on the location you provide. You're responsible
              for keeping this reasonably accurate — broadcasts and matching are only as
              reliable as the location information you've shared.
            </p>
          </Section>

          <Section title="Suspension and termination">
            <p>
              We may suspend or terminate your account if you violate these Terms, our
              community guidelines, or if we reasonably believe your account poses a risk to
              other users or to EchoToCrowd. You may also delete your account at any time.
            </p>
          </Section>

          <Section title="Disclaimers">
            <p>
              EchoToCrowd is provided "as is." We do not guarantee that the service will be
              uninterrupted, error-free, or that any particular broadcast, message, or user
              interaction will meet your expectations. You interact with other users at your own
              discretion and risk.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the maximum extent permitted by law, EchoToCrowd and its operators will not be
              liable for any indirect, incidental, or consequential damages arising from your
              use of the service.
            </p>
          </Section>

          <Section title="Governing law">
            <p>
              These Terms are governed by the laws of the Province of Ontario and the federal
              laws of Canada applicable therein, without regard to conflict-of-law principles.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these Terms from time to time. If we make material changes, we'll
              notify you through the app or by email before they take effect. Continued use of
              EchoToCrowd after changes take effect constitutes acceptance of the updated Terms.
            </p>
          </Section>

          <Section title="Contact us">
            <p>
              Questions about these Terms? Reach us at{" "}
              <a href="mailto:legal@echotocrowd.com" className="text-signal-400 hover:text-signal-300">
                legal@echotocrowd.com
              </a>.
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
