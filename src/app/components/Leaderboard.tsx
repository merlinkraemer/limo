'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Lemonade } from '@/types/lemonade';
import { addLemonade } from '../actions';
import { uploadImage } from '@/lib/supabase/storage';

type SortKey = 'rank' | 'overall_score' | 'flavor_rating' | 'sourness_rating' | 'created_at' | 'name';
type SortDir = 'asc' | 'desc';

export function Leaderboard({ initialData }: { initialData: Lemonade[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Lemonade | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flavorRating, setFlavorRating] = useState(0);
  const [sournessRating, setSournessRating] = useState(0);

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      let imageUrl: string | undefined;
      const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
      const file = fileInput?.files?.[0];
      if (file) {
        imageUrl = await uploadImage(file);
      }

      const result = await addLemonade({
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        flavorRating,
        sournessRating,
        imageUrl,
        locationCity: (formData.get('locationCity') as string) || undefined,
      });

      if ('error' in result) {
        setError(result.error);
      } else {
        setShowAddModal(false);
        setFlavorRating(0);
        setSournessRating(0);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <header>
        <h1>
          🍋&ensp;limo leaderboard
          <span className="header-links">
            <button className="link-btn" onClick={() => setShowRules(true)}>rules</button>
            <button className="link-btn link-btn-red" onClick={() => setShowAddModal(true)}>add your lemonade</button>
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
              <th onClick={() => handleSort('created_at')} className="sortable col-date-cell">
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
              sorted.map((entry, i) => (
                <tr
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className="clickable"
                >
                  <td>{medals[rankMap.get(entry.id)!] || rankMap.get(entry.id)}</td>
                  <td>{entry.name}</td>
                  <td>{entry.overall_score.toFixed(1)} ☆</td>
                  <td>{entry.flavor_rating} ☆</td>
                  <td>{entry.sourness_rating} ☆</td>
                  <td className="col-date-cell">{new Date(entry.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => !submitting && setShowAddModal(false)}>x</button>
            <h2>add new entry</h2>
            <form onSubmit={handleSubmit}>
              <label>
                name *
                <input type="text" name="name" required minLength={2} maxLength={100} />
              </label>
              <label>
                description
                <textarea name="description" maxLength={500} rows={3} />
              </label>
              <label>
                image
                <input type="file" name="image" accept="image/*" />
              </label>
              <label>
                city
                <input type="text" name="locationCity" maxLength={100} />
              </label>
              <label>
                flavor rating *
                <div className="star-rating">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span
                      key={i}
                      className={i < flavorRating ? 'star filled' : 'star'}
                      onClick={() => setFlavorRating(i + 1)}
                    >
                      {i < flavorRating ? '★' : '☆'}
                    </span>
                  ))}
                  {flavorRating > 0 && <span className="star-count">{flavorRating}/10</span>}
                </div>
              </label>
              <label>
                sourness rating *
                <div className="star-rating">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span
                      key={i}
                      className={i < sournessRating ? 'star filled' : 'star'}
                      onClick={() => setSournessRating(i + 1)}
                    >
                      {i < sournessRating ? '★' : '☆'}
                    </span>
                  ))}
                  {sournessRating > 0 && <span className="star-count">{sournessRating}/10</span>}
                </div>
              </label>
              {error && <p className="error">{error}</p>}
              <div className="modal-actions">
                <button type="submit" className="link-btn" disabled={submitting}>
                  {submitting ? 'submitting...' : 'submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRules && (
        <div className="modal-overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowRules(false)}>x</button>
            <h2>rules</h2>
            <p>1. only canned lemonades accepted</p>
            <p>2. lemonades can be any sort of non-alcoholic soda type beverage</p>
          </div>
        </div>
      )}

      {selectedEntry && (
        <div className="modal-overlay" onClick={() => setSelectedEntry(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedEntry(null)}>x</button>
            <h2>{selectedEntry.name}</h2>
            <p>{selectedEntry.description}</p>
            <br />
            <p>overall: {selectedEntry.overall_score.toFixed(1)}/10</p>
            <p>flavor: {selectedEntry.flavor_rating}/10</p>
            <p>sourness: {selectedEntry.sourness_rating}/10</p>
            {selectedEntry.location_city && <p>city: {selectedEntry.location_city}</p>}
            <p>added: {new Date(selectedEntry.created_at).toLocaleDateString()}</p>
            {selectedEntry.image_url && (
              <div className="detail-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedEntry.image_url} alt={selectedEntry.name} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
