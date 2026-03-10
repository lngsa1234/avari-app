'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, X, AlertCircle, Info } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const COLORS = {
  success: { bg: 'bg-green-50 border-green-200', icon: 'text-green-500', text: 'text-green-800' },
  error: { bg: 'bg-red-50 border-red-200', icon: 'text-red-500', text: 'text-red-800' },
  info: { bg: 'bg-blue-50 border-blue-200', icon: 'text-blue-500', text: 'text-blue-800' },
};

function ToastItem({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);
  const colors = COLORS[toast.type] || COLORS.info;
  const Icon = ICONS[toast.type] || Info;

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg max-w-sm w-full transition-all duration-300 ${colors.bg} ${
        exiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
      style={{ animation: exiting ? 'none' : 'slideIn 0.3s ease-out' }}
    >
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${colors.icon}`} />
      <p className={`text-sm flex-1 ${colors.text}`}>{toast.message}</p>
      <button
        onClick={() => { setExiting(true); setTimeout(() => onDismiss(toast.id), 300); }}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <>
      <style jsx global>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const success = useCallback((msg) => show(msg, 'success'), [show]);
  const error = useCallback((msg) => show(msg, 'error', 5000), [show]);
  const info = useCallback((msg) => show(msg, 'info'), [show]);

  return { toasts, dismiss, show, success, error, info };
}
