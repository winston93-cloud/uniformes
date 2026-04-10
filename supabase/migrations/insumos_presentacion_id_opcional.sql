-- Proveedor/presentación opcional en insumos (UI: select «Proveedor» puede quedar vacío).
ALTER TABLE public.insumos
  ALTER COLUMN presentacion_id DROP NOT NULL;
