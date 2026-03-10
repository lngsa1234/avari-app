'use client';

const colors = {
  primary: '#8B6F5C',
  text: '#3F1906',
  textLight: '#584233',
  textMuted: 'rgba(107, 86, 71, 0.77)',
  cream: '#FDF8F3',
  border: 'rgba(139, 111, 92, 0.15)',
};

const fonts = {
  serif: '"Lora", Georgia, serif',
  sans: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export default function PrivacyPolicy() {
  return (
    <div style={{ background: colors.cream, minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', fontFamily: fonts.sans, color: colors.textLight, lineHeight: 1.8 }}>
        <a href="/" style={{ color: colors.primary, fontSize: 14, textDecoration: 'none' }}>&larr; Back to CircleW</a>

        <h1 style={{ fontFamily: fonts.serif, color: colors.text, fontSize: 32, marginTop: 24, marginBottom: 8 }}>
          Privacy Policy
        </h1>
        <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 32 }}>Last updated: March 9, 2026</p>

        <Section title="1. Information We Collect">
          <strong>Account Information:</strong> When you create an account, we collect your name, email address, profile picture, and professional information (role, industry, career stage, bio, location).
          <br /><br />
          <strong>Usage Data:</strong> We collect information about how you use the Service, including pages visited, features used, and interactions with other users (connections, messages, meetup attendance).
          <br /><br />
          <strong>Location Data:</strong> If you enable location detection, we collect your approximate location (city, state, country) via your browser. We do not track your precise location continuously.
          <br /><br />
          <strong>Call Data:</strong> When you participate in video or audio calls, we may process audio for live transcription and meeting recaps. Transcription data is used solely to generate summaries for participants.
          <br /><br />
          <strong>Device Information:</strong> We collect basic device information such as browser type, operating system, and screen size to optimize your experience.
        </Section>

        <Section title="2. How We Use Your Information">
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>Matchmaking:</strong> Your profile information (role, industry, interests, age) is used to suggest relevant connections, circles, and meetups.</li>
            <li><strong>Communication:</strong> We use your email to send notifications about connections, meetup invitations, and important service updates.</li>
            <li><strong>AI Features:</strong> Your profile and interaction data may be processed by AI models to generate icebreaker suggestions, connection recommendations, and meeting recaps.</li>
            <li><strong>Service Improvement:</strong> Aggregated, anonymized usage data helps us understand how to improve CircleW.</li>
            <li><strong>Safety:</strong> We may use data to detect and prevent abuse, fraud, or violations of our Terms of Service.</li>
          </ul>
        </Section>

        <Section title="3. Information Sharing">
          <strong>With Other Users:</strong> Your profile information (name, photo, bio, role, industry, location) is visible to other CircleW members. Your email address is not shared with other users.
          <br /><br />
          <strong>Service Providers:</strong> We use third-party services to operate CircleW:
          <ul style={{ paddingLeft: 20 }}>
            <li>Supabase (database and authentication)</li>
            <li>Agora / LiveKit (video calling)</li>
            <li>Deepgram (speech transcription, when enabled)</li>
            <li>OpenAI / Anthropic (AI features)</li>
            <li>Vercel (hosting)</li>
          </ul>
          These providers process data only as necessary to provide their services and are bound by their own privacy policies.
          <br /><br />
          <strong>We do not sell your personal information to third parties.</strong>
        </Section>

        <Section title="4. Data Storage and Security">
          Your data is stored securely using Supabase with row-level security policies. We use encryption in transit (HTTPS/TLS) and follow industry-standard security practices. However, no method of electronic storage is 100% secure, and we cannot guarantee absolute security.
        </Section>

        <Section title="5. Your Rights and Choices">
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>Access and Update:</strong> You can view and update your profile information at any time through the app.</li>
            <li><strong>Delete:</strong> You can request deletion of your account and associated data by contacting us.</li>
            <li><strong>Location:</strong> Location detection is optional. You can decline the browser permission prompt or manually enter your location.</li>
            <li><strong>Notifications:</strong> You can manage email notification preferences in your settings.</li>
            <li><strong>Transcription:</strong> Call transcription can be disabled. When disabled, no audio is processed for transcription.</li>
          </ul>
        </Section>

        <Section title="6. Cookies and Local Storage">
          We use browser local storage to maintain your session and store preferences (e.g., onboarding completion status). We do not use tracking cookies or third-party advertising cookies.
        </Section>

        <Section title="7. Children's Privacy">
          CircleW is not intended for users under 18 years of age. We do not knowingly collect information from children. If we discover that a child has provided us with personal information, we will delete it promptly.
        </Section>

        <Section title="8. Data Retention">
          We retain your data for as long as your account is active. If you delete your account, we will remove your personal data within 30 days, except where retention is required by law or necessary for legitimate business purposes (e.g., fraud prevention).
        </Section>

        <Section title="9. International Users">
          CircleW is operated from the United States. If you access the Service from outside the US, your data may be transferred to and processed in the US. By using the Service, you consent to this transfer.
        </Section>

        <Section title="10. Changes to This Policy">
          We may update this Privacy Policy from time to time. We will notify you of material changes through the Service or by email. The "Last updated" date at the top indicates the most recent revision.
        </Section>

        <Section title="11. Contact Us">
          If you have questions or concerns about this Privacy Policy or your data, please reach out to us through the feedback feature in the app.
        </Section>

        <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: 40, paddingTop: 20 }}>
          <p style={{ fontSize: 13, color: colors.textMuted }}>&copy; {new Date().getFullYear()} CircleW. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#3F1906', marginBottom: 8 }}>{title}</h2>
      <div style={{ fontSize: 15 }}>{children}</div>
    </div>
  );
}
