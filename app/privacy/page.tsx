import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Community Food Exchange",
  description:
    "How Community Food Exchange collects, uses, and protects your information.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="font-bold text-lg text-stone-900 mb-2">{title}</h2>
      <div className="text-sm leading-relaxed text-stone-600 space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 via-emerald-50 to-stone-50 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/login" className="text-sm font-semibold text-green-700 hover:text-green-800">
          ← Back to sign in
        </Link>
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-100 mt-4">
          <div className="text-4xl mb-3">🍽️</div>
          <h1 className="font-playfair font-bold text-3xl text-stone-900 mb-1">Privacy Policy</h1>
          <p className="text-sm text-stone-400 mb-6">Last updated: November 2026</p>

          <Section title="What Community Food Exchange is">
            <p>
              Community Food Exchange (&ldquo;CFE&rdquo;, &ldquo;we&rdquo;) is a community
              platform where neighbours share homemade dishes and swap them for
              credits. This policy explains what information we collect, how we
              use it, and the choices you have.
            </p>
          </Section>

          <Section title="Information we collect">
            <p>When you use CFE, we collect:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Name and email address from your Google or Facebook
                account</strong> — to create your account and sign you in. A
                phone number is optional; you can add one in your profile.
              </li>
              <li>
                <strong>Profile details you add</strong> — such as a photo and bio.
              </li>
              <li>
                <strong>Dish listings</strong> — title, description, ingredients,
                photos, pickup times, and the pickup location you provide.
              </li>
              <li>
                <strong>Swaps, messages, and ratings</strong> — including chat messages
                with other members, swap history, and credit transactions.
              </li>
              <li>
                <strong>Location</strong> — only when you choose to share it, for
                example to show nearby dishes or share your location during a
                pickup.
              </li>
              <li>
                <strong>Session information</strong> — a single secure session cookie
                that keeps you signed in. We do not use advertising trackers.
              </li>
            </ul>
          </Section>

          <Section title="How we use your information">
            <p>We use your information to run the service: to sign you in,
            show nearby dishes, arrange swaps, keep credits accurate,
            prevent abuse, and keep the platform safe. We do not sell your
            personal information to anyone.</p>
          </Section>

          <Section title="Who can see your information">
            <p>
              Other members can see your public profile (name, photo, dishes,
              ratings) and the pickup location of dishes you list. Your phone
              number, if you add one, is never shown to other members. Service providers help us
              run CFE — Google and Facebook provide sign-in, an image
              host stores dish photos, and a database host stores your account
              data. They only process information as needed to provide those
              services.
            </p>
          </Section>

          <Section title="Sign-in and security">
            <p>
              You sign in with your Google or Facebook account. We never see
              your Google or Facebook password, and we never ask for it. Your
              session is stored in a secure, httpOnly cookie that
              JavaScript on the page cannot read.
            </p>
          </Section>

          <Section title="How long we keep your information">
            <p>
              We keep your information while your account is active. If you stop
              using CFE, you can sign out at any time; to request deletion of
              your account and personal data, contact the team running the
              service (see below).
            </p>
          </Section>

          <Section title="Children">
            <p>
              CFE is intended for people aged 18 and over. We do not knowingly
              collect personal information from children.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy as the service grows. When we do, we
              will update the date above and, for significant changes, let
              members know in the app.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy, or a request for a copy or deletion
              of your data, can be sent to the team operating Community Food
              Exchange. A dedicated support email address will be published on
              this page when one is set up.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
