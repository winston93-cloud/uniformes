-- Columna faltante en insumos (existía en Supabase, no en DDL inicial de Bloque 3)
ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS stock_minimo DECIMAL(10, 2) DEFAULT 0 CHECK (stock_minimo >= 0);

COMMENT ON COLUMN public.insumos.stock_minimo IS
  'Cantidad mínima de stock. Si el stock actual cae por debajo, se genera alerta en el dashboard.';

CREATE INDEX IF NOT EXISTS idx_insumos_stock_minimo ON public.insumos(stock_minimo)
  WHERE stock_minimo > 0;
