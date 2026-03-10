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

export default function TermsOfService() {
  return (
    <div style={{ background: colors.cream, minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', fontFamily: fonts.sans, color: colors.textLight, lineHeight: 1.8 }}>
        <a href="/" style={{ color: colors.primary, fontSize: 14, textDecoration: 'none' }}>&larr; Back to CircleW</a>

        <h1 style={{ fontFamily: fonts.serif, color: colors.text, fontSize: 32, marginTop: 24, marginBottom: 8 }}>
          Terms of Service
        </h1>
        <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 32 }}>Last updated: March 9, 2026</p>

        <Section title="1. Acceptance of Terms">
          By accessing or using CircleW ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.
        </Section>

        <Section title="2. Description of Service">
          CircleW is a professional networking community designed for women to build meaningful connections through circles, meetups, coffee chats, and video calls. The Service includes profile creation, matchmaking, messaging, video conferencing, and AI-powered features.
        </Section>

        <Section title="3. Eligibility">
          You must be at least 18 years old to use CircleW. By creating an account, you represent that you meet this requirement and that the information you provide is accurate.
        </Section>

        <Section title="4. Account Responsibilities">
          <ul style={{ paddingLeft: 20 }}>
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You are responsible for all activities that occur under your account.</li>
            <li>You agree to provide accurate, current, and complete profile information.</li>
            <li>You must notify us immediately of any unauthorized use of your account.</li>
          </ul>
        </Section>

        <Section title="5. Acceptable Use">
          You agree not to:
          <ul style={{ paddingLeft: 20 }}>
            <li>Use the Service for any unlawful purpose or to solicit others to perform illegal acts.</li>
            <li>Harass, abuse, or harm other users.</li>
            <li>Impersonate any person or misrepresent your identity or affiliation.</li>
            <li>Send spam, unsolicited messages, or promotional content to other users.</li>
            <li>Attempt to gain unauthorized access to any part of the Service.</li>
            <li>Use automated tools, bots, or scrapers to access the Service.</li>
            <li>Upload content that is offensive, defamatory, or infringes on others' rights.</li>
          </ul>
        </Section>

        <Section title="6. User Content">
          You retain ownership of content you post on CircleW (profile information, messages, photos). By posting content, you grant CircleW a non-exclusive, worldwide license to use, display, and distribute your content solely for the purpose of operating the Service. You may delete your content at any time, which will remove it from the Service.
        </Section>

        <Section title="7. AI Features">
          CircleW uses artificial intelligence for features such as connection recommendations, icebreaker suggestions, and meeting recaps. AI-generated content is provided for convenience and may not always be accurate. You should not rely on AI outputs as professional or personal advice.
        </Section>

        <Section title="8. Video and Audio Calls">
          When participating in video or audio calls through CircleW, you consent to your audio and video being transmitted to other participants. Call transcriptions, when enabled, are processed to provide meeting recaps and are subject to our Privacy Policy.
        </Section>

        <Section title="9. Community Guidelines">
          CircleW is a supportive professional community. We expect all members to:
          <ul style={{ paddingLeft: 20 }}>
            <li>Treat others with respect and professionalism.</li>
            <li>Keep conversations constructive and inclusive.</li>
            <li>Respect others' privacy and boundaries.</li>
            <li>Report inappropriate behavior to our team.</li>
          </ul>
          We reserve the right to suspend or terminate accounts that violate these guidelines.
        </Section>

        <Section title="10. Intellectual Property">
          The Service, including its design, features, and technology, is owned by CircleW. You may not copy, modify, or reverse-engineer any part of the Service without our written permission.
        </Section>

        <Section title="11. Termination">
          We may suspend or terminate your account at our discretion if you violate these Terms. You may delete your account at any time. Upon termination, your right to use the Service ceases immediately.
        </Section>

        <Section title="12. Disclaimers">
          The Service is provided "as is" without warranties of any kind. We do not guarantee that the Service will be uninterrupted, error-free, or secure. We are not responsible for the actions or content of other users.
        </Section>

        <Section title="13. Limitation of Liability">
          To the maximum extent permitted by law, CircleW shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.
        </Section>

        <Section title="14. Changes to Terms">
          We may update these Terms from time to time. We will notify you of material changes through the Service or by email. Continued use after changes constitutes acceptance of the updated Terms.
        </Section>

        <Section title="15. Contact">
          If you have questions about these Terms, please reach out to us through the feedback feature in the app.
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
