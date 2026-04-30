-- Allow authenticated users (admin) to delete objects in limo buckets
CREATE POLICY "Authenticated users can delete limo images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('limo-images', 'lemonade-images'));
