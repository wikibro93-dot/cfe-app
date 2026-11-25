import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Community Food Exchange",
  description:
    "The terms for using Community Food Exchange to share and swap homemade dishes with neighbours.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="font-bold text-lg text-stone-900 mb-2">{title}</h2>
      <div className="text-sm leading-relaxed text-stone-600 space-y-2">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 via-emerald-50 to-stone-50 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/login" className="text-sm font-semibold text-green-700 hover:text-green-800">
          ← Back to sign in
        </Link>
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-100 mt-4">
          <div className="text-4xl mb-3">🍽️</div>
          <h1 className="font-playfair font-bold text-3xl text-stone-900 mb-1">Terms of Service</h1>
          <p className="text-sm text-stone-400 mb-6">Last updated: November 2026</p>

          <Section title="What the service is">
            <p>
              Community Food Exchange (&ldquo;CFE&rdquo;, &ldquo;we&rdquo;) is a community
              platform where neighbours share homemade dishes and swap them for
              credits. CFE is a platform that connects members — it does not
              cook, sell, or deliver food itself. By creating an account or
              using the service, you agree to these terms.
            </p>
          </Section>

          <Section title="Who can use CFE">
            <p>
              You must be at least 18 years old to use CFE. You need a Google
              or Facebook account to sign in. One person may have one
              account. You are responsible for keeping your sign-in account
              secure and for anything done on your account. Never share your
              Google or Facebook password with anyone, including someone
              claiming to be from CFE.
            </p>
          </Section>

          <Section title="Your listings and food safety">
            <p>
              When you list a dish, describe it honestly: what it is, its
              ingredients, and any common allergens. You are responsible for
              the food you share — its preparation, hygiene, storage, and
              labelling. Only list food you would be happy to eat yourself, and
              only list dishes you are allowed to share. CFE does not inspect
              food and cannot guarantee its safety or quality.
            </p>
          </Section>

          <Section title="Swaps and credits">
            <p>
              A swap is an agreement between the members involved. Credits are
              a community measure inside CFE, not money: they cannot be
              exchanged for cash, transferred outside CFE, or refunded. New
              members start with 10 credits. Paid credit top-ups are not
              currently offered. Meet in a safe, public place for pickups, and
              only confirm a swap once you have received the dish.
            </p>
          </Section>

          <Section title="Your content">
            <p>
              You keep ownership of the photos and descriptions you post. By
              posting them, you give CFE permission to display them to other
              members as part of the service. Do not post content you do not
              have the right to share, or that is misleading, offensive, or
              unlawful.
            </p>
          </Section>

          <Section title="What is not allowed">
            <ul className="list-disc pl-5 space-y-1">
              <li>Fake listings, scams, or misrepresenting a dish.</li>
              <li>Harassing, threatening, or misleading other members.</li>
              <li>Reselling dishes or credits for money outside CFE.</li>
              <li>Spam, scraping, automated access, or trying to break the service.</li>
              <li>Using CFE for anything unlawful.</li>
            </ul>
          </Section>

          <Section title="Suspension and removal">
            <p>
              Accounts or listings that break these terms may be suspended or
              removed by CFE administrators. If you believe a decision was a
              mistake, contact the team operating the service.
            </p>
          </Section>

          <Section title="Our responsibility">
            <p>
              CFE is provided &ldquo;as is&rdquo; while the service is being built and
              improved. We work to keep it running, but we do not promise it
              will always be available or error-free. Because swaps are between
              members, CFE is not responsible for the food exchanged, for
              meetings between members, or for any loss arising from a swap.
              Nothing in these terms limits liability that cannot be limited by
              law.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms as the service grows. When we do, we
              will update the date above and, for significant changes, let
              members know in the app. Continuing to use CFE after a change
              means you accept the updated terms.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms can be sent to the team operating
              Community Food Exchange. A dedicated support email address will
              be published on this page when one is set up.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
