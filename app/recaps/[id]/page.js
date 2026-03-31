'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CoffeeChatRecapView from '@/components/CoffeeChatRecapView';
import { createOnNavigate } from '@/lib/navigationAdapter';

export default function RecapDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recapId = params.id;
  const handleNavigate = createOnNavigate(router);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FDF8F3',
      fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      paddingBottom: '80px',
      overflowX: 'hidden',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{
        maxWidth: '896px',
        margin: '0 auto',
        padding: isMobile ? '16px' : '24px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <CoffeeChatRecapView
          recapId={recapId}
          onNavigate={handleNavigate}
          previousView="home"
        />
      </div>
    </div>
  );
}
