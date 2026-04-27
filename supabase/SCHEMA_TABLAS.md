# Origen del DDL por tabla (Uniformes)

La base **no** sale de un solo SQL maestro: el proyecto creció con `schema.sql`, migraciones en `supabase/migrations/` y scripts legacy en `supabase/*.sql`. La herramienta `/migracion` busca `CREATE TABLE` en ese orden (ver `lib/migracion/ddlFromRepoMigrations.ts`).

Esta tabla enlaza cada nombre **con el archivo donde está el `CREATE TABLE`** que usa la migración InsForge (primer match que encuentra el scanner).

| Tabla | Archivo principal del CREATE |
|-------|-------------------------------|
| usuario_perfil | `migrations/create_usuario_perfil.sql` |
| roles_uniformes | `migrations/create_usuarios_uniformes.sql` |
| tallas | `schema.sql` |
| categorias_prendas | `schema.sql` (también `migracion_categorias.sql`) |
| presentaciones | `crear_tabla_presentaciones.sql` |
| ubicaciones_almacenamiento | `migrations/add_ubicacion_almacenamiento_insumos.sql` |
| sucursales | `migrations/create_sucursales.sql` |
| ciclos_escolares | `migrations/create_ciclos_escolares.sql` |
| usuario | `migrations/create_usuario_legacy.sql` (legacy; distinta de `usuarios`) |
| usuarios | `schema.sql` |
| usuarios_uniformes | `migrations/create_usuarios_uniformes.sql` |
| alumnos, externos, prendas, costos | `schema.sql` |
| insumos | **`migrations/create_insumos.sql`** (actual con `presentacion_id`); el script `crear_tabla_insumos.sql` es legacy con `presentacion` VARCHAR |
| prenda_talla_insumos | `crear_tabla_prenda_talla_insumos.sql` |
| compras_insumos | `crear_tabla_compras_insumos.sql` |
| costo_ubicaciones | `migrations/create_costo_ubicaciones.sql` |
| insumo_ubicaciones | `migrations/create_insumo_ubicaciones.sql` |
| datos_fiscales_cliente | `migrations/create_datos_fiscales_cliente.sql` |
| cotizaciones, detalle_cotizacion | `crear_tablas_cotizaciones.sql` |
| pedidos, detalle_pedidos, movimientos | `schema.sql` |
| cortes, detalle_cortes | `schema.sql` |
| transferencias, detalle_transferencias | `migrations/create_transferencias.sql` |
| devoluciones, detalle_devoluciones | `migrations/create_devoluciones.sql` |
| auditoria, snapshot_insumos_pedido | `migrations/fix_integridad_datos.sql` |

**Nota:** Si en Supabase aplicaste cambios solo desde el Dashboard y no los volcaste a estos archivos, el repo no los “conoce” hasta que los añadas aquí.
