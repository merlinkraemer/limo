'use client';

import React, { useEffect } from 'react';

export function Modal({
  open,
  onClose,
  children,
  preventClose = false,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  preventClose?: boolean;
}) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !preventClose) onClose();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose, preventClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={() => !preventClose && onClose()}
    >
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="modal-close"
          onClick={() => !preventClose && onClose()}
        >
          x
        </button>
        {children}
      </div>
    </div>
  );
}
