import { Link } from 'react-router-dom'

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Privacy Policy</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">Effective date: June 2026 · Last updated: June 2026</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            This policy applies to personal data collected through the Shepherd platform, operated by ByteCraft,
            in accordance with the Philippines Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations.
          </p>
        </div>

        <div className="space-y-8 text-[var(--foreground)]">

          <Section title="1. Who We Are">
            <p>ByteCraft ("we", "us", or "our") is the developer and operator of Shepherd, a cloud-based Kids Ministry Check-In platform. When you register a church account, we act as a <strong>personal information controller</strong> with respect to the data you provide to us about your organization and its administrators. For children's and guardian data that your church enters into the system, your church acts as the controller and we act as a <strong>personal information processor</strong> under your instruction.</p>
            <p>Contact: <strong>support@shepherdapp.com</strong></p>
          </Section>

          <Section title="2. Data We Collect">
            <p>We collect and process the following categories of personal information:</p>

            <p className="font-medium text-[var(--foreground)]">Church and administrator data (provided directly by you):</p>
            <ul>
              <li>Church name and contact details</li>
              <li>Administrator and staff names, email addresses, and phone numbers</li>
              <li>Account credentials (passwords stored as irreversible hashes — we cannot read them)</li>
            </ul>

            <p className="font-medium text-[var(--foreground)]">Children's ministry data (entered by your church staff):</p>
            <ul>
              <li>Children's first and last names</li>
              <li>Date of birth and calculated age</li>
              <li>Medical or allergy notes (if entered)</li>
              <li>Class group assignment</li>
              <li>Guardian names and contact phone numbers</li>
              <li>Attendance records including check-in and check-out times</li>
              <li>Pick-up authorization codes generated per check-in</li>
            </ul>

            <p className="font-medium text-[var(--foreground)]">Technical and usage data (collected automatically):</p>
            <ul>
              <li>Authentication tokens used to maintain your logged-in session</li>
              <li>Standard web server logs (IP addresses, browser type, request timestamps) for security and diagnostics</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Data">
            <p>We use personal data only for the following purposes:</p>
            <ul>
              <li><strong>Providing the Service</strong> — processing check-ins, generating pick-up codes, recording attendance, and displaying reports</li>
              <li><strong>Account management</strong> — authenticating users, managing roles and permissions</li>
              <li><strong>Security and fraud prevention</strong> — detecting and preventing unauthorized access</li>
              <li><strong>Service improvement</strong> — understanding how the platform is used in aggregate (no individual profiling)</li>
              <li><strong>Support</strong> — responding to your requests and resolving technical issues</li>
            </ul>
            <p>We do not use your data for advertising, profiling, or any purpose beyond operating and improving Shepherd.</p>
          </Section>

          <Section title="4. Children's Personal Data">
            <p>Shepherd processes sensitive personal information about minors (children) on behalf of churches. We recognize the heightened responsibility this carries.</p>
            <ul>
              <li>Children's data is entered by your church staff and is used solely to operate the check-in and check-out workflow.</li>
              <li>We do not use children's data for any secondary purpose.</li>
              <li>Your church, as the data controller for children's information, is responsible for obtaining proper consent from parents or guardians before entering this data.</li>
              <li>Medical notes are stored only when provided and are accessible only to authorized staff of your church.</li>
            </ul>
          </Section>

          <Section title="5. Data Isolation and Security">
            <p>Each church's data is <strong>strictly isolated</strong> from all other churches. Your staff can only see data belonging to your church. This isolation is enforced at the database level on every query.</p>
            <p>Security measures we employ:</p>
            <ul>
              <li>All data in transit is encrypted using TLS/HTTPS</li>
              <li>Passwords are hashed using bcrypt — we cannot recover or view them</li>
              <li>Session tokens are rotated on login and invalidated on logout</li>
              <li>Access to production systems is restricted to authorized personnel</li>
            </ul>
          </Section>

          <Section title="6. Data Sharing">
            <p>We do not sell, rent, or share your personal data with third parties for marketing or commercial purposes.</p>
            <p>We may share data only in the following limited circumstances:</p>
            <ul>
              <li><strong>Infrastructure providers</strong> — cloud hosting and database services used to run Shepherd (e.g., Railway, Render). These providers act as sub-processors under data processing agreements.</li>
              <li><strong>Legal obligations</strong> — if required to do so by applicable law, court order, or government authority.</li>
            </ul>
          </Section>

          <Section title="7. Data Retention">
            <p>We retain your church's data for as long as your account is active. If you close your account:</p>
            <ul>
              <li>Your data remains accessible for <strong>30 days</strong> after account closure to allow you to export it.</li>
              <li>After 30 days, all church data — including children's records, guardian contacts, attendance logs, and staff accounts — is permanently deleted.</li>
            </ul>
            <p>Server logs are retained for up to 90 days for security purposes, then purged.</p>
          </Section>

          <Section title="8. Your Rights">
            <p>Under the Philippines Data Privacy Act and applicable law, you have the right to:</p>
            <ul>
              <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
              <li><strong>Correction</strong> — request correction of inaccurate data (you can also update most data directly in the platform)</li>
              <li><strong>Erasure</strong> — request deletion of your personal data</li>
              <li><strong>Portability</strong> — export your data via the CSV export features available in the platform</li>
              <li><strong>Object</strong> — object to certain processing activities</li>
            </ul>
            <p>To exercise any of these rights, contact us at <strong>support@shepherdapp.com</strong>. We will respond within 15 business days.</p>
          </Section>

          <Section title="9. Cookies and Session Storage">
            <p>Shepherd uses browser <strong>localStorage</strong> to store your authentication token so you remain logged in between sessions. We do not use advertising cookies or third-party tracking scripts.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. When we make material changes, we will notify you via email or a notice within the platform at least 7 days before the changes take effect. Continued use of Shepherd after that date constitutes acceptance of the updated policy.</p>
          </Section>

          <Section title="11. Contact and Data Protection Officer">
            <p>For privacy inquiries, data requests, or complaints:</p>
            <p className="font-medium text-[var(--foreground)]">
              ByteCraft — Data Privacy Officer<br />
              Email: privacy@shepherdapp.com<br />
              You may also lodge a complaint with the National Privacy Commission (NPC) of the Philippines at <strong>www.privacy.gov.ph</strong>.
            </p>
          </Section>
        </div>

        {/* Footer links */}
        <div className="mt-12 pt-6 border-t border-[var(--border)] flex flex-wrap gap-4 text-sm text-[var(--muted-foreground)]">
          <Link to="/terms" className="hover:text-[var(--foreground)] transition-colors">Terms of Service</Link>
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
