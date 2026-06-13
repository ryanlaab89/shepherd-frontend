import { Link } from 'react-router-dom'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Top bar */}
      <div className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--primary)] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="font-bold text-[var(--foreground)]">Shepherd</span>
          </div>
          <Link to="/login"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
            ← Back to login
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Terms of Service</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">Effective date: June 2026 · Last updated: June 2026</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-[var(--foreground)]">

          <Section title="1. About Shepherd">
            <p>Shepherd is a cloud-based Kids Ministry Check-In platform operated by ByteCraft ("we", "us", or "our"). It is designed to help churches manage child registration, attendance tracking, and guardian pick-up coordination.</p>
            <p>By registering a church account and using the Service, you ("Church" or "you") agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </Section>

          <Section title="2. Account Registration">
            <p>To use Shepherd, you must register a church account using a valid church name, administrator name, and email address. You are responsible for:</p>
            <ul>
              <li>Providing accurate and complete registration information.</li>
              <li>Maintaining the confidentiality of your account credentials.</li>
              <li>All activity that occurs under your account, including actions by staff and volunteers you add.</li>
            </ul>
            <p>You must promptly notify us at <strong>support@shepherdapp.com</strong> of any unauthorized use of your account.</p>
          </Section>

          <Section title="3. Use of the Service">
            <p>You agree to use Shepherd only for lawful purposes and in accordance with these Terms. You must not:</p>
            <ul>
              <li>Use the Service to process data of children without the knowledge and consent of their guardians.</li>
              <li>Share access credentials with unauthorized individuals outside your church organization.</li>
              <li>Attempt to reverse-engineer, scrape, or disrupt the Service or its underlying systems.</li>
              <li>Upload or transmit any material that is unlawful, harmful, or violates a third party's rights.</li>
            </ul>
          </Section>

          <Section title="4. Children's Data">
            <p>Shepherd is a tool for churches to manage their own children's ministry data. You, as the Church, are responsible for:</p>
            <ul>
              <li>Obtaining appropriate consent from parents or guardians before entering children's personal information into the system.</li>
              <li>Ensuring that your use of Shepherd complies with applicable laws governing the collection and processing of children's data, including the Philippines Data Privacy Act of 2012 (RA 10173) and any other applicable local laws.</li>
              <li>Informing parents and guardians of your church's privacy practices.</li>
            </ul>
          </Section>

          <Section title="5. Data Ownership">
            <p>All data you enter into Shepherd — including church information, staff accounts, children's records, guardian contacts, and attendance logs — remains your property. We do not claim ownership over your data.</p>
            <p>You may export your data at any time using the CSV export features available throughout the platform. Upon account termination, we will retain your data for 30 days to allow for final export, after which it will be permanently deleted.</p>
          </Section>

          <Section title="6. Data Security and Multi-Tenancy">
            <p>Shepherd is a multi-tenant platform. Each church's data is logically isolated from all other churches using the same system. We implement industry-standard security measures including encrypted connections (HTTPS/TLS), access controls, and secure credential storage.</p>
            <p>However, no internet-based system can guarantee absolute security. You acknowledge that you provide data at your own risk and are responsible for maintaining appropriate access controls within your church account.</p>
          </Section>

          <Section title="7. Service Availability">
            <p>We strive to keep Shepherd available at all times but do not guarantee uninterrupted availability. The Service may be temporarily unavailable due to maintenance, upgrades, or circumstances beyond our control. We will provide reasonable advance notice of planned maintenance where possible.</p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>To the maximum extent permitted by applicable law, Shepherd and ByteCraft shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, loss of revenue, or loss of goodwill, arising from your use of or inability to use the Service.</p>
            <p>Our total liability for any claim arising from these Terms or the Service shall not exceed the amount you paid us in the three months preceding the claim, or PHP 1,000, whichever is greater.</p>
          </Section>

          <Section title="9. Modifications to the Service and Terms">
            <p>We reserve the right to modify or discontinue the Service at any time with reasonable notice. We may also update these Terms. We will notify you of material changes by email or by a prominent notice within the platform. Continued use of the Service after changes take effect constitutes your acceptance of the revised Terms.</p>
          </Section>

          <Section title="10. Termination">
            <p>You may stop using Shepherd at any time by contacting us at <strong>support@shepherdapp.com</strong>. We reserve the right to suspend or terminate your account if you violate these Terms, with or without prior notice depending on the severity of the violation.</p>
          </Section>

          <Section title="11. Governing Law">
            <p>These Terms are governed by and construed in accordance with the laws of the Republic of the Philippines. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of the Philippines.</p>
          </Section>

          <Section title="12. Contact">
            <p>For questions about these Terms of Service, please contact us:</p>
            <p className="font-medium">ByteCraft<br />Email: support@shepherdapp.com</p>
          </Section>
        </div>

        {/* Footer links */}
        <div className="mt-12 pt-6 border-t border-[var(--border)] flex flex-wrap gap-4 text-sm text-[var(--muted-foreground)]">
          <Link to="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy Policy</Link>
          <Link to="/login" className="hover:text-[var(--foreground)] transition-colors">Back to Login</Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2">{title}</h2>
      <div className="space-y-3 text-sm text-[var(--muted-foreground)] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-[var(--foreground)] [&_strong]:font-semibold">
        {children}
      </div>
    </div>
  )
}
