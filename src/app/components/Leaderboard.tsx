'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Lemonade } from '@/types/lemonade';
import { LoadingImg } from './LoadingImg';
import { Modal } from './Modal';
import { LemonadeFormModal } from './LemonadeFormModal';
import { AdminEntryMenu } from './AdminEntryMenu';
import { logoutAdmin } from '../actions';

type SortKey = 'rank' | 'overall_score' | 'flavor_rating' | 'sourness_rating' | 'created_at' | 'name';
type SortDir = 'asc' | 'desc';

function useIsTouch() {
  const [isTouch] = useState(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });
  return isTouch;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function Leaderboard({
  initialData,
  isAdmin = false,
}: {
  initialData: Lemonade[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const isTouch = useIsTouch();
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoverEntry, setHoverEntry] = useState<Lemonade | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  const rankMap = new Map<string, number>();
  [...initialData]
    .sort((a, b) => b.overall_score - a.overall_score || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach((entry, i) => rankMap.set(entry.id, i + 1));

  const medals: Record<number, string> = { 1: ' \u{1F947}', 2: ' \u{1F948}', 3: ' \u{1F949}' };

  const sorted = [...initialData].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'rank') {
      cmp = rankMap.get(a.id)! - rankMap.get(b.id)!;
    } else if (sortKey === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortKey === 'created_at') {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else {
      cmp = a[sortKey] - b[sortKey];
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'rank' ? 'asc' : 'desc');
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return <span className="sort-arrow hidden"> ▲</span>;
    return <span className="sort-arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>;
  }

  return (
    <>
      <header>
        <h1>
          🍋&ensp;lemolist - rank ur lemonade!
          <span className="header-links">
            {isAdmin && (
              <form action={logoutAdmin}>
                <button type="submit" className="link-btn desktop-only">logout</button>
              </form>
            )}
            <button className="link-btn desktop-only" onClick={() => setShowRules(true)}>rules</button>
            <button className="link-btn link-btn-red desktop-only" onClick={() => setShowAddModal(true)}>add your lemonade</button>
          </span>
        </h1>
      </header>

      <div className="table-wrap">
        <table>
          <colgroup>
            <col className="col-rank" />
            <col className="col-name" />
            <col className="col-score" />
            <col className="col-score" />
            <col className="col-score" />
            <col className="col-date" />
          </colgroup>
          <thead>
            <tr>
              <th onClick={() => handleSort('rank')} className="sortable">
                #{sortIndicator('rank')}
              </th>
              <th onClick={() => handleSort('name')} className="sortable">
                name{sortIndicator('name')}
              </th>
              <th onClick={() => handleSort('overall_score')} className="sortable">
                overall{sortIndicator('overall_score')}
              </th>
              <th onClick={() => handleSort('flavor_rating')} className="sortable">
                flavor{sortIndicator('flavor_rating')}
              </th>
              <th onClick={() => handleSort('sourness_rating')} className="sortable">
                sourness{sortIndicator('sourness_rating')}
              </th>
              <th onClick={() => handleSort('created_at')} className="sortable">
                added{sortIndicator('created_at')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty">
                  no entries yet
                </td>
              </tr>
            ) : (
              sorted.map((entry) => {
                const isExpanded = expandedId === entry.id;
                return (
                  <React.Fragment key={entry.id}>
                    <tr
                      onClick={() => { setExpandedId(isExpanded ? null : entry.id); setHoverEntry(null); }}
                      className={`clickable${isExpanded ? ' expanded' : ''}`}
                      onMouseEnter={() => !isTouch && !isExpanded && entry.image_url && setHoverEntry(entry)}
                      onMouseMove={e => !isTouch && !isExpanded && entry.image_url && setHoverPos({ x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => !isTouch && setHoverEntry(null)}
                    >
                      <td>{medals[rankMap.get(entry.id)!] || rankMap.get(entry.id)}</td>
                      <td>{entry.name}</td>
                      <td>{entry.overall_score.toFixed(1)} ☆</td>
                      <td>{entry.flavor_rating} ☆</td>
                      <td>{entry.sourness_rating} ☆</td>
                      <td className="cell-actions">
                        {formatDate(entry.created_at)}
                        {isAdmin && (
                          <AdminEntryMenu
                            entry={entry}
                            onDeleted={() => router.refresh()}
                            onEditClose={() => router.refresh()}
                          />
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="detail-row">
                        <td colSpan={6}>
                          <div className="row-detail">
                            {entry.image_url && (
                              <div className="detail-image">
                                <LoadingImg src={entry.image_url} alt={entry.name} />
                              </div>
                            )}
                            <div className="detail-info">
                              {entry.description && <p className="detail-description">{entry.description}</p>}
                              <div className="detail-scores">
                                <span>flavor: {entry.flavor_rating}/10</span>
                                <span>sourness: {entry.sourness_rating}/10</span>
                              </div>
                              <div className="detail-meta">
                                {entry.location_city && <span>{entry.location_city}</span>}
                                <span>{formatDate(entry.created_at)}</span>
                                {entry.added_by && <span>by {entry.added_by}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {hoverEntry?.image_url && (
        <div
          className="hover-preview"
          style={{ left: hoverPos.x + 16, top: hoverPos.y + 16 }}
        >
          <LoadingImg src={hoverEntry.image_url} alt={hoverEntry.name} />
        </div>
      )}

      {showAddModal && (
        <LemonadeFormModal
          mode="create"
          onClose={() => setShowAddModal(false)}
          onSuccess={() => setShowAddModal(false)}
        />
      )}

      <Modal open={showRules} onClose={() => setShowRules(false)}>
        <h2>rules</h2>
        <p>1. only canned lemonades accepted</p>
        <p>2. lemonades can be any sort of non-alcoholic soda type beverage</p>
      </Modal>

      <button className="fab mobile-only" onClick={() => setShowAddModal(true)} aria-label="Add lemonade" />

      <footer className="site-footer">
        help us find the best lemonade ever pls 👉👈
        <span className="footer-divider"> · </span>
        {isAdmin && (
          <>
            <form action={logoutAdmin} className="footer-inline-form">
              <button type="submit" className="link-btn">logout</button>
            </form>
            <span className="footer-divider"> · </span>
          </>
        )}
        <button className="link-btn footer-rules-link" onClick={() => setShowRules(true)}>rules</button>
      </footer>
    </>
  );
}
