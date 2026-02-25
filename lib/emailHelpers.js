/**
 * Email Notification Helpers
 *
 * Sends coffee chat email notifications via Resend.
 * All errors are caught and logged — never thrown.
 */

import { Resend } from 'resend';

let resendClient = null;

function getResend() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[Email] RESEND_API_KEY not set — emails disabled');
      return null;
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return { date, time };
}

function buildEmailHTML({ heading, body, ctaText, ctaUrl }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#FAF5EF;font-family:'Georgia','Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF5EF;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#FFFFFF;border-radius:12px;border:1px solid #E8DDD1;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background-color:#523C2E;padding:24px 32px;">
          <h1 style="margin:0;font-family:'Georgia',serif;font-size:22px;font-weight:600;color:#F5EDE9;letter-spacing:0.3px;">CircleW</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 20px;font-family:'Georgia',serif;font-size:20px;font-weight:600;color:#523C2E;">${heading}</h2>
          <div style="font-family:'Georgia',serif;font-size:15px;line-height:1.7;color:#6B5B4E;">
            ${body}
          </div>
          ${ctaText ? `
          <table cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
            <tr><td style="background-color:#523C2E;border-radius:20px;padding:12px 28px;">
              <a href="${ctaUrl}" style="font-family:'Georgia',serif;font-size:15px;font-weight:600;color:#F5EDE9;text-decoration:none;font-style:italic;">${ctaText}</a>
            </td></tr>
          </table>` : ''}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #E8DDD1;">
          <p style="margin:0;font-family:'Georgia',serif;font-size:12px;color:#B8A089;">Sent by CircleW — meaningful connections, one coffee at a time.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildNewRequestEmail(requesterProfile, recipientProfile, chat) {
  const { date, time } = formatDateTime(chat.scheduled_time);
  const name = requesterProfile.name || 'Someone';

  return {
    to: recipientProfile.email,
    subject: `${name} wants to coffee chat with you`,
    html: buildEmailHTML({
      heading: `${name} wants to coffee chat with you!`,
      body: `
        <p style="margin:0 0 16px;"><strong>${name}</strong>${requesterProfile.career ? ` (${requesterProfile.career})` : ''} has invited you to a 1:1 video coffee chat.</p>
        <div style="background-color:#FAF5EF;border-radius:8px;padding:16px;margin:0 0 16px;">
          <p style="margin:0 0 6px;font-size:14px;color:#523C2E;"><strong>When:</strong> ${date} at ${time}</p>
          ${chat.notes ? `<p style="margin:6px 0 0;font-size:14px;color:#523C2E;font-style:italic;">"${chat.notes}"</p>` : ''}
        </div>
        <p style="margin:0;">Open CircleW to accept or decline.</p>
      `,
      ctaText: 'View Request',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://circlew.app'}/`,
    }),
  };
}

function buildAcceptedEmail(requesterProfile, recipientProfile, chat) {
  const { date, time } = formatDateTime(chat.scheduled_time);
  const name = recipientProfile.name || 'Your connection';

  return {
    to: requesterProfile.email,
    subject: `${name} accepted your coffee chat request!`,
    html: buildEmailHTML({
      heading: `${name} accepted your coffee chat!`,
      body: `
        <p style="margin:0 0 16px;">Great news — <strong>${name}</strong> accepted your coffee chat request.</p>
        <div style="background-color:#FAF5EF;border-radius:8px;padding:16px;margin:0 0 16px;">
          <p style="margin:0 0 6px;font-size:14px;color:#523C2E;"><strong>When:</strong> ${date} at ${time}</p>
          <p style="margin:6px 0 0;font-size:14px;color:#523C2E;"><strong>With:</strong> ${name}${recipientProfile.career ? ` — ${recipientProfile.career}` : ''}</p>
        </div>
        <p style="margin:0;">Your video room is ready. Join when it's time!</p>
      `,
      ctaText: 'Open CircleW',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://circlew.app'}/`,
    }),
  };
}

function buildDeclinedEmail(requesterProfile, recipientProfile, chat) {
  const name = recipientProfile.name || 'Your connection';

  return {
    to: requesterProfile.email,
    subject: `Coffee chat update from ${name}`,
    html: buildEmailHTML({
      heading: `Coffee chat update`,
      body: `
        <p style="margin:0 0 16px;"><strong>${name}</strong> wasn't able to make the time work for this coffee chat — but don't take it personally!</p>
        <p style="margin:0 0 16px;">Schedules can be tricky. Feel free to suggest a new time or explore other connections on CircleW.</p>
        <p style="margin:0;color:#9B8A7E;font-style:italic;">Every great connection starts with a simple hello.</p>
      `,
      ctaText: 'Back to CircleW',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://circlew.app'}/`,
    }),
  };
}

/**
 * Send a coffee chat email notification.
 *
 * @param {'new_request'|'accepted'|'declined'} notificationType
 * @param {object} chat - coffee_chats row
 * @param {object} requesterProfile - profile of the requester
 * @param {object} recipientProfile - profile of the recipient
 */
export async function sendCoffeeChatEmail(notificationType, chat, requesterProfile, recipientProfile) {
  const resend = getResend();
  if (!resend) return;

  try {
    let emailData;
    switch (notificationType) {
      case 'new_request':
        emailData = buildNewRequestEmail(requesterProfile, recipientProfile, chat);
        break;
      case 'accepted':
        emailData = buildAcceptedEmail(requesterProfile, recipientProfile, chat);
        break;
      case 'declined':
        emailData = buildDeclinedEmail(requesterProfile, recipientProfile, chat);
        break;
      default:
        console.error('[Email] Unknown notification type:', notificationType);
        return;
    }

    if (!emailData.to) {
      console.warn('[Email] No recipient email — skipping');
      return;
    }

    const { error } = await resend.emails.send({
      from: 'CircleW <onboarding@resend.dev>',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
    });

    if (error) {
      console.error('[Email] Resend error:', error);
    } else {
      console.log(`[Email] Sent ${notificationType} email to ${emailData.to}`);
    }
  } catch (err) {
    console.error('[Email] Failed to send:', err);
  }
}
