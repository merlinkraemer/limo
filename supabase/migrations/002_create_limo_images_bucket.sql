INSERT INTO storage.buckets (id, name, public)
VALUES ('limo-images', 'limo-images', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public can view limo images" ON storage.objects;
CREATE POLICY "Public can view limo images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('limo-images', 'lemonade-images'));

DROP POLICY IF EXISTS "Public can upload limo images" ON storage.objects;
CREATE POLICY "Public can upload limo images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id IN ('limo-images', 'lemonade-images'));

DROP POLICY IF EXISTS "Public can update limo images" ON storage.objects;
CREATE POLICY "Public can update limo images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id IN ('limo-images', 'lemonade-images'))
WITH CHECK (bucket_id IN ('limo-images', 'lemonade-images'));

DROP POLICY IF EXISTS "Public can delete limo images" ON storage.objects;
CREATE POLICY "Public can delete limo images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id IN ('limo-images', 'lemonade-images'));
