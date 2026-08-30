import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = { title: "Privacy Policy — EchoToCrowd" };

export default function PrivacyPage() {
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
        <h1 className="font-display text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-parchment-500 text-sm mb-10">Last updated: August 30, 2026</p>

        <div className="space-y-8 text-parchment-300 leading-relaxed">
          <Section title="Who we are">
            <p>
              EchoToCrowd is operated by 1001721403 Ontario Inc. ("EchoToCrowd," "we," "us"), a
              corporation registered in Ontario, Canada. This policy explains what personal
              information we collect through the EchoToCrowd app and website, why we collect it,
              and the choices you have.
            </p>
          </Section>

          <Section title="Information we collect">
            <SubHeading>Account information</SubHeading>
            <p>
              When you sign in with Google or Apple, we receive your name, email address, and a
              unique identifier from that provider. We do not receive or store your password for
              those accounts.
            </p>
            <SubHeading>Date of birth</SubHeading>
            <p>
              We collect your date of birth to confirm you meet our minimum age requirement (see
              our <Link href="/terms" className="text-signal-400 hover:text-signal-300">Terms of
              Service</Link>). We store this to enforce that requirement going forward.
            </p>
            <SubHeading>Location</SubHeading>
            <p>
              We collect your device or manually-entered location so we can show you broadcasts
              posted nearby and determine how far your own broadcasts reach. Your precise
              coordinates are stored so distance calculations work correctly, but other users
              never see your exact location — only an approximate distance (e.g. "3.8 km away")
              or the general area label you choose to display.
            </p>
            <SubHeading>Content you create</SubHeading>
            <p>
              This includes broadcasts, replies, private messages, profile photos, and any other
              images or files you upload. Uploaded images are automatically scanned by AWS
              Rekognition for content moderation and by AWS GuardDuty for malware, and broadcast
              text is automatically screened using OpenAI's moderation tooling, before or shortly
              after being made visible to others — see "Automated moderation" below.
            </p>
            <SubHeading>Payment information</SubHeading>
            <p>
              If you subscribe to a paid tier, payments are processed by Stripe. We do not
              receive or store your full card number — Stripe handles that directly. We do
              receive confirmation of your subscription status and tier from Stripe.
            </p>
            <SubHeading>Identity verification</SubHeading>
            <p>
              Some account tiers require identity verification through Stripe Identity, which may
              involve submitting a government-issued ID and a live photo. This verification is
              processed by Stripe on our behalf under their own privacy practices; we receive
              confirmation of your verification result, not a copy of your ID.
            </p>
            <SubHeading>Usage information</SubHeading>
            <p>
              We collect standard technical information such as device type, app version, and
              general usage patterns to keep the service running and improve it.
            </p>
          </Section>

          <Section title="Automated moderation">
            <p>
              To help keep EchoToCrowd safe, images you upload are automatically analyzed by AWS
              Rekognition, and broadcast text is automatically analyzed by OpenAI's moderation
              model, to detect content that may violate our community guidelines. Content flagged
              with lower confidence may be sent for human review by an EchoToCrowd administrator;
              content flagged with high confidence may be hidden or blocked automatically pending
              review. These automated systems process content but do not make final account-level
              decisions like suspension — a human administrator reviews flagged reports before
              any account action is taken.
            </p>
          </Section>

          <Section title="How we use your information">
            <ul className="list-disc pl-5 space-y-1">
              <li>To operate core features: matching broadcasts to your location and interests, delivering messages, and displaying your profile to others as you've configured it.</li>
              <li>To verify your age and identity where required.</li>
              <li>To process payments and manage subscriptions.</li>
              <li>To detect and act on content that violates our community guidelines.</li>
              <li>To communicate with you about your account, security, or changes to our services.</li>
              <li>To comply with legal obligations.</li>
            </ul>
          </Section>

          <Section title="Who we share information with">
            <p>We share information only as needed to operate the service:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Other users</strong> see what you choose to share in your profile and broadcasts, plus approximate distance — never your exact coordinates.</li>
              <li><strong>Service providers</strong> we rely on to run EchoToCrowd, including Amazon Web Services (hosting, storage, image moderation, malware scanning), OpenAI (text moderation), Stripe (payments and identity verification), and Google (authentication).</li>
              <li><strong>Legal authorities</strong>, where required by law or to protect the safety of our users.</li>
            </ul>
            <p className="mt-2">We do not sell your personal information.</p>
          </Section>

          <Section title="Your choices">
            <ul className="list-disc pl-5 space-y-1">
              <li>You can edit or remove most profile information at any time in the app.</li>
              <li>You can block or report other users.</li>
              <li>You can request deletion of your account and associated data by contacting us at the address below.</li>
              <li>You can opt out of appearing in other users' broadcasts discovery via your profile settings.</li>
            </ul>
          </Section>

          <Section title="Data retention">
            <p>
              We retain your information for as long as your account is active, and for a limited
              period afterward as needed to comply with legal obligations, resolve disputes, and
              enforce our agreements. Content removed for moderation reasons may be retained
              longer for audit and safety purposes.
            </p>
          </Section>

          <Section title="Children's privacy">
            <p>
              EchoToCrowd is not intended for anyone under 16, and we do not knowingly collect
              information from anyone under that age. See our{" "}
              <Link href="/terms" className="text-signal-400 hover:text-signal-300">Terms of Service</Link> for details.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy from time to time. If we make material changes, we'll
              notify you through the app or by email before they take effect.
            </p>
          </Section>

          <Section title="Contact us">
            <p>
              Questions about this policy or your data? Reach us at{" "}
              <a href="mailto:privacy@echotocrowd.com" className="text-signal-400 hover:text-signal-300">
                privacy@echotocrowd.com
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

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="font-semibold text-parchment-100 mt-4 mb-1 text-sm">{children}</h3>;
}
