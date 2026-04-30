'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Lemonade } from '@/types/lemonade';
import { deleteLemonade } from '../actions';
import { LemonadeFormModal } from './LemonadeFormModal';

export function AdminEntryMenu({
  entry,
  onDeleted,
  onEditClose,
}: {
  entry: Lemonade;
  onDeleted: () => void;
  onEditClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownRect({ top: rect.bottom + 2, left: rect.right - 100 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  async function handleDelete() {
    if (!confirm(`Delete "${entry.name}"?`)) return;
    setDeleting(true);
    const result = await deleteLemonade(entry.id, entry.image_url);
    setDeleting(false);
    setOpen(false);
    if ('error' in result) {
      alert(result.error);
    } else {
      onDeleted();
    }
  }

  const dropdownPortal =
    open &&
    dropdownRect &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={dropdownRef}
        className="admin-menu-dropdown admin-menu-dropdown-portal"
        style={{ top: dropdownRect.top, left: dropdownRect.left }}
      >
        <button
          type="button"
          className="admin-menu-item"
          onClick={e => { e.stopPropagation(); setOpen(false); setShowEdit(true); }}
        >
          Edit
        </button>
        <button
          type="button"
          className="admin-menu-item admin-menu-item-danger"
          onClick={e => { e.stopPropagation(); handleDelete(); }}
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>,
      document.body
    );

  return (
    <>
      <div className="admin-entry-menu">
        <button
          ref={triggerRef}
          type="button"
          className="admin-menu-trigger"
          onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
          aria-label="Admin menu"
          aria-expanded={open}
        >
          ⋮
        </button>
        {dropdownPortal}
      </div>
      {showEdit && (
        <LemonadeFormModal
          mode="edit"
          initialData={entry}
          onClose={() => { setShowEdit(false); onEditClose(); }}
          onSuccess={() => { setShowEdit(false); onEditClose(); }}
        />
      )}
    </>
  );
}
