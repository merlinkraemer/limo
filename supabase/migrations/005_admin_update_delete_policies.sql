-- Allow authenticated users (admin) to update and delete lemonades
CREATE POLICY "Authenticated users can update lemonades"
ON public.lemonades FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete lemonades"
ON public.lemonades FOR DELETE
TO authenticated
USING (true);
