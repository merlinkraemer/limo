'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Lemonade } from '@/types/lemonade';
import { addLemonade, editLemonade } from '../actions';
import { uploadImage } from '@/lib/supabase/storage';
import { Modal } from './Modal';
import { StarRating } from './StarRating';
import { LoadingImg } from './LoadingImg';

const formId = 'lemonade-form-image-input';

export function LemonadeFormModal({
  mode,
  initialData,
  onClose,
  onSuccess,
}: {
  mode: 'create' | 'edit';
  initialData?: Lemonade;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const isEdit = mode === 'edit';

  const [flavorRating, setFlavorRating] = useState(isEdit && initialData ? initialData.flavor_rating : 0);
  const [sournessRating, setSournessRating] = useState(isEdit && initialData ? initialData.sourness_rating : 0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (flavorRating === 0 || sournessRating === 0) {
      setError('please rate both flavor and sourness');
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);
    const fileInput = form.querySelector<HTMLInputElement>(`#${formId}`);
    const file = fileInput?.files?.[0];

    if (file && file.size > 5 * 1024 * 1024) {
      setError('image is too large - max 5MB');
      return;
    }

    setSubmitting(true);

    try {
      let imageUrl: string | undefined;
      if (file) {
        setUploading(true);
        try {
          imageUrl = await uploadImage(file);
        } catch {
          setError('failed to upload image - please try again');
          setUploading(false);
          setSubmitting(false);
          return;
        }
        setUploading(false);
      } else if (isEdit && initialData) {
        if (imageRemoved) {
          imageUrl = undefined;
        } else {
          imageUrl = initialData.image_url ?? undefined;
        }
      }

      const payload = {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        flavorRating,
        sournessRating,
        imageUrl,
        locationCity: (formData.get('locationCity') as string) || undefined,
        addedBy: (formData.get('addedBy') as string) || undefined,
      };

      const result = isEdit && initialData
        ? await editLemonade({ id: initialData.id, ...payload })
        : await addLemonade(payload);

      if ('error' in result) {
        setError(result.error);
      } else {
        onSuccess();
        onClose();
        router.refresh();
      }
    } catch {
      setError('something went wrong - please try again');
    } finally {
      setSubmitting(false);
    }
  }

  const currentImageUrl = isEdit && initialData && !imageRemoved ? initialData.image_url : null;

  return (
    <Modal
      open
      onClose={onClose}
      preventClose={submitting || uploading}
    >
      <h2>{isEdit ? 'edit lemonade' : 'add ur lemonade'}</h2>
      <form onSubmit={handleSubmit}>
        <label>
          lemonade name *
          <input
            type="text"
            name="name"
            required
            minLength={2}
            maxLength={100}
            placeholder="e.g. San Pellegrino Limonata"
            defaultValue={initialData?.name}
          />
        </label>
        <label>
          description
          <textarea
            name="description"
            maxLength={500}
            rows={2}
            placeholder="special flavor? Tastes like bubblegum?? type whatever here"
            defaultValue={initialData?.description ?? ''}
          />
        </label>
        <div className="rating-row">
          <label>
            flavor *
            <StarRating value={flavorRating} onChange={setFlavorRating} max={10} />
          </label>
          <label>
            sourness *
            <StarRating value={sournessRating} onChange={setSournessRating} max={10} />
          </label>
        </div>
        <div className="file-upload">
          <input
            type="file"
            name="image"
            accept="image/*"
            id={formId}
            className="file-input-hidden"
            onChange={e => setFileName(e.target.files?.[0]?.name ?? null)}
          />
          {isEdit && currentImageUrl ? (
            <div className="edit-image-row">
              <div className="detail-image">
                <LoadingImg src={currentImageUrl} alt={initialData?.name ?? 'current'} />
              </div>
              <div>
                <label htmlFor={formId} className={`file-upload-btn${uploading ? ' uploading' : ''}`}>
                  {uploading ? <span>uploading<span className="dots" /></span> : fileName ? fileName : 'replace photo'}
                </label>
                <button
                  type="button"
                  className="link-btn link-btn-red"
                  onClick={() => { setImageRemoved(true); setFileName(null); }}
                >
                  remove photo
                </button>
              </div>
            </div>
          ) : (
            <label htmlFor={formId} className={`file-upload-btn${uploading ? ' uploading' : ''}`}>
              {uploading ? <span>uploading<span className="dots" /></span> : fileName ? fileName : '+ add photo'}
            </label>
          )}
        </div>
        <div className="form-row">
          <label>
            city
            <input
              type="text"
              name="locationCity"
              maxLength={100}
              defaultValue={initialData?.location_city ?? ''}
            />
          </label>
          <label>
            your name
            <input
              type="text"
              name="addedBy"
              maxLength={100}
              defaultValue={initialData?.added_by ?? ''}
            />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="submit-btn" disabled={submitting || uploading}>
          {uploading ? (
            <span>uploading image<span className="dots" /></span>
          ) : submitting ? (
            <span>submitting<span className="dots" /></span>
          ) : isEdit ? (
            'save changes'
          ) : (
            'add lemonade'
          )}
        </button>
      </form>
    </Modal>
  );
}
