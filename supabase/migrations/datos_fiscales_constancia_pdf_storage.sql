-- PDF de constancia de situación fiscal (SAT) en Storage + ruta en datos_fiscales_cliente.

ALTER TABLE datos_fiscales_cliente
  ADD COLUMN IF NOT EXISTS constancia_pdf_path TEXT;

COMMENT ON COLUMN datos_fiscales_cliente.constancia_pdf_path IS
  'Ruta dentro del bucket datos-fiscales-clientes (ej. {uuid}/constancia-situacion-fiscal.pdf).';

-- Bucket privado; descarga vía signed URL desde la app.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'datos-fiscales-clientes',
  'datos-fiscales-clientes',
  false,
  5242880,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "constancias_fiscales_select" ON storage.objects;
DROP POLICY IF EXISTS "constancias_fiscales_insert" ON storage.objects;
DROP POLICY IF EXISTS "constancias_fiscales_update" ON storage.objects;
DROP POLICY IF EXISTS "constancias_fiscales_delete" ON storage.objects;

CREATE POLICY "constancias_fiscales_select"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'datos-fiscales-clientes');

CREATE POLICY "constancias_fiscales_insert"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'datos-fiscales-clientes');

CREATE POLICY "constancias_fiscales_update"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'datos-fiscales-clientes')
  WITH CHECK (bucket_id = 'datos-fiscales-clientes');

CREATE POLICY "constancias_fiscales_delete"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'datos-fiscales-clientes');
