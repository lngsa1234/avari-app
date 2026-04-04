'use client';

import { useState } from 'react';
import { Share2, Download, Copy, X, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { colors as tokens, fonts } from '@/lib/designTokens';

const COLORS = {
  brown700: tokens.buttonBg,
  brown500: tokens.primary,
  brown400: '#A68B7B',
  brown100: '#E8DDD0',
  bgCard: tokens.bgCard,
  green: '#4A7C59',
  greenLight: '#E8F2EB',
  white: tokens.white,
};

const FONT = fonts.sans;
const DISPLAY_FONT = fonts.serif;

export default function ShareProfileModal({ userId, username, name, onClose }) {
  const profileUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/people/${username || userId}`
    : '';
  const displayHandle = username ? `@${username}` : (name || 'Profile');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, animation: 'fadeIn 0.2s',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 20,
          padding: '24px 24px 28px', width: '90%', maxWidth: 420,
          animation: 'slideUp 0.25s',
        }}
      >
        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 600, color: COLORS.brown700 }}>
            Share Profile
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: COLORS.brown400 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* QR Code */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            background: 'white', padding: 16, borderRadius: 16,
            border: `1px solid ${COLORS.brown100}`,
          }}>
            <QRCodeSVG
              id="profile-qr-code"
              value={profileUrl}
              size={180}
              level="M"
              fgColor={COLORS.brown700}
              bgColor="white"
            />
          </div>
        </div>

        {/* Profile name under QR */}
        <p style={{
          textAlign: 'center', fontFamily: FONT, fontSize: 13,
          color: COLORS.brown400, marginBottom: 24,
        }}>
          {displayHandle} on CircleW
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          {/* Share Profile */}
          <button
            onClick={async () => {
              if (navigator.share) {
                try {
                  await navigator.share({ title: `${displayHandle} on CircleW`, url: profileUrl });
                } catch (e) { /* cancelled */ }
              }
            }}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '14px 8px', borderRadius: 14, border: `1px solid ${COLORS.brown100}`,
              background: COLORS.bgCard, cursor: 'pointer', fontFamily: FONT,
            }}
          >
            <Share2 size={20} style={{ color: COLORS.brown500 }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.brown700 }}>Share</span>
          </button>

          {/* Copy Link */}
          <CopyLinkButton profileUrl={profileUrl} />

          {/* Download QR */}
          <button
            onClick={() => {
              const svg = document.getElementById('profile-qr-code');
              if (!svg) return;
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const svgData = new XMLSerializer().serializeToString(svg);
              const img = new Image();
              img.onload = () => {
                canvas.width = 600;
                canvas.height = 680;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, 600, 680);
                ctx.drawImage(img, 60, 40, 480, 480);
                ctx.fillStyle = '#3D2B1F';
                ctx.font = 'bold 28px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(displayHandle, 300, 570);
                ctx.fillStyle = '#A68B7B';
                ctx.font = '20px sans-serif';
                ctx.fillText('on CircleW', 300, 605);
                const link = document.createElement('a');
                link.download = `${(name || 'profile').replace(/\s+/g, '-')}-circlew-qr.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                URL.revokeObjectURL(url);
              };
              const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              img.src = url;
            }}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '14px 8px', borderRadius: 14, border: `1px solid ${COLORS.brown100}`,
              background: COLORS.bgCard, cursor: 'pointer', fontFamily: FONT,
            }}
          >
            <Download size={20} style={{ color: COLORS.brown500 }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.brown700 }}>Download</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyLinkButton({ profileUrl }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(profileUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '14px 8px', borderRadius: 14,
        border: `1px solid ${copied ? COLORS.green : COLORS.brown100}`,
        background: copied ? COLORS.greenLight : COLORS.bgCard,
        cursor: 'pointer', fontFamily: FONT, transition: 'all 0.2s',
      }}
    >
      {copied ? <Check size={20} style={{ color: COLORS.green }} /> : <Copy size={20} style={{ color: COLORS.brown500 }} />}
      <span style={{ fontSize: 12, fontWeight: 500, color: copied ? COLORS.green : COLORS.brown700 }}>
        {copied ? 'Copied!' : 'Copy Link'}
      </span>
    </button>
  );
}
