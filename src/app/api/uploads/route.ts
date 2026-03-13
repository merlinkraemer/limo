import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  DEFAULT_STORAGE_BUCKET,
  getFileExtension,
  getStorageBucketCandidates,
  isBucketNotFoundError,
} from '@/lib/supabase/storage.shared';

async function ensureBucketExists(bucket: string) {
  const supabase = createServiceClient();
  const { error } = await supabase.storage.createBucket(bucket, { public: true });

  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing upload file.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const fileExt = getFileExtension(file);
    const filePath = `uploads/${randomUUID()}.${fileExt}`;
    const configuredBucket =
      process.env.SUPABASE_STORAGE_BUCKET?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim();
    const bucketCandidates = getStorageBucketCandidates(configuredBucket);

    for (const bucket of bucketCandidates) {
      let { error } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (error && isBucketNotFoundError(error) && bucket === DEFAULT_STORAGE_BUCKET) {
        await ensureBucketExists(bucket);

        const retry = await supabase.storage.from(bucket).upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });
        error = retry.error;
      }

      if (error) {
        if (isBucketNotFoundError(error)) {
          continue;
        }

        return NextResponse.json({ error: error.message || 'Upload failed.' }, { status: 500 });
      }

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return NextResponse.json({ publicUrl: publicUrlData.publicUrl });
    }

    return NextResponse.json(
      {
        error: `Storage bucket missing. Checked ${bucketCandidates.join(', ')}. Run the latest Supabase migration or set SUPABASE_STORAGE_BUCKET.`,
      },
      { status: 500 }
    );
  } catch (error) {
    console.error('Upload route error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Upload failed.',
      },
      { status: 500 }
    );
  }
}
