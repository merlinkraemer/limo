'use client';

import React from 'react';

export function StarRating({
  value,
  onChange,
  max = 10,
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
}) {
  return (
    <div className="star-rating">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={i < value ? 'star filled' : 'star'}
          onClick={() => onChange(i + 1)}
        >
          {i < value ? '★' : '☆'}
        </span>
      ))}
      {value > 0 && <span className="star-count">{value}/{max}</span>}
    </div>
  );
}
