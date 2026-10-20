-- Errores y avisos que ve el usuario en pantalla y que nunca llegan a la base (validaciones, fallas al guardar,
-- selecciones descartadas). Los reporta el navegador por /api/eventos-cliente y los lee el banco de Uniformes del
-- Main Control Room (servicios_admin). La tabla no se expone: solo se escribe con registrar_evento_uniformes().
CREATE TABLE IF NOT EXISTS public.uniformes_eventos_cliente (
  id bigserial PRIMARY KEY,
  creado_en timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL CHECK (tipo IN ('error', 'silencioso', 'aviso')),
  pantalla text NOT NULL,
  mensaje text NOT NULL,
  detalle text,
  usuario text
);
CREATE INDEX IF NOT EXISTS uniformes_eventos_cliente_fecha ON public.uniformes_eventos_cliente (creado_en DESC);

ALTER TABLE public.uniformes_eventos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniformes_eventos_cliente FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uniformes_eventos_cliente_deny ON public.uniformes_eventos_cliente;
CREATE POLICY uniformes_eventos_cliente_deny ON public.uniformes_eventos_cliente
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.uniformes_eventos_cliente FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.uniformes_eventos_cliente_id_seq FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_evento_uniformes(
  p_tipo text,
  p_pantalla text,
  p_mensaje text,
  p_detalle text DEFAULT NULL,
  p_usuario text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '2s'
AS $function$
BEGIN
  IF p_tipo NOT IN ('error', 'silencioso', 'aviso') OR coalesce(trim(p_mensaje), '') = '' THEN
    RETURN;
  END IF;
  -- Tope contra ráfagas o abuso: nunca más de 120 eventos por minuto en total.
  IF (SELECT count(*) FROM uniformes_eventos_cliente WHERE creado_en > now() - interval '1 minute') >= 120 THEN
    RETURN;
  END IF;
  INSERT INTO uniformes_eventos_cliente (tipo, pantalla, mensaje, detalle, usuario)
  VALUES (
    p_tipo,
    left(coalesce(nullif(trim(p_pantalla), ''), '?'), 120),
    left(trim(p_mensaje), 500),
    left(p_detalle, 2000),
    left(p_usuario, 120)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_evento_uniformes(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_evento_uniformes(text, text, text, text, text) TO anon, authenticated;
