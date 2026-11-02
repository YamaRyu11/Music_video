import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
export function Popup({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null), close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current!;
    const root = document.getElementById('root'); const wasInert = root?.inert ?? false; if(root) root.inert = true;
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]'));
    (focusable()[0] ?? panel).focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.current(); }
      if (e.key === 'Tab') {
        const items = focusable(), first = items[0], last = items[items.length-1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    panel.addEventListener('keydown',key);
    return () => { panel.removeEventListener('keydown',key); if(root) root.inert = wasInert; if (previous?.isConnected) previous.focus({preventScroll:true}); };
  }, []);
  return createPortal(<div className="color-popup-scrim" onClick={e => { e.stopPropagation(); if(e.target === e.currentTarget) onClose(); }}>
    <div className={`color-popup ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
      <div className="color-popup-title"><h2>{title}</h2><button aria-label="ポップアップを閉じる" onClick={onClose}><X size={18}/></button></div>{children}
    </div>
  </div>,document.body);
}
