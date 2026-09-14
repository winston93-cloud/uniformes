import { NextResponse } from 'next/server'
import { getInsforge } from '@/lib/insforge'

function isTaller(nombre: unknown) {
  return String(nombre ?? '')
    .trim()
    .toLowerCase() === 'taller'
}

/**
 * Alinea costo_ubicaciones con costos.stock.
 * Si hay stock > 0 y no hay partidas, crea una en Taller (o la primera ubicación activa).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const costoId = String(body?.costo_id ?? '').trim()
    if (!costoId) {
      return NextResponse.json({ success: false, error: 'Falta costo_id' }, { status: 400 })
    }

    const db = getInsforge().database

    const { data: costo, error: costoErr } = await db
      .from('costos')
      .select('id, stock')
      .eq('id', costoId)
      .maybeSingle()
    if (costoErr) throw costoErr
    if (!costo?.id) {
      return NextResponse.json({ success: false, error: 'Costo no encontrado' }, { status: 404 })
    }

    const stock = Math.max(0, Number((costo as { stock?: number }).stock ?? 0) || 0)

    const { data: ubRows, error: ubErr } = await db
      .from('costo_ubicaciones')
      .select('id, ubicacion_almacenamiento_id, cantidad, ubicaciones_almacenamiento(nombre)')
      .eq('costo_id', costoId)
    if (ubErr) throw ubErr

    const filas = (ubRows ?? []) as Array<{
      id: string
      ubicacion_almacenamiento_id: string
      cantidad: number | null
      ubicaciones_almacenamiento?: { nombre?: string | null } | null
    }>

    // Stock huérfano: hay total pero ninguna ubicación → crear en Taller
    if (!filas.length) {
      if (stock <= 0) {
        return NextResponse.json({
          success: true,
          costo_id: costoId,
          adjusted: false,
          note: 'Sin ubicaciones y stock 0.',
        })
      }

      const { data: ubicaciones, error: ubListErr } = await db
        .from('ubicaciones_almacenamiento')
        .select('id, nombre, activo')
        .eq('activo', true)
      if (ubListErr) throw ubListErr

      const activas = (ubicaciones ?? []) as Array<{ id: string; nombre: string }>
      const taller = activas.find((u) => isTaller(u.nombre))
      const destino = taller ?? activas[0]
      if (!destino?.id) {
        return NextResponse.json(
          {
            success: false,
            error: 'No hay ubicaciones activas para asignar el stock.',
          },
          { status: 400 }
        )
      }

      const { error: insErr } = await db.from('costo_ubicaciones').insert({
        costo_id: costoId,
        ubicacion_almacenamiento_id: destino.id,
        cantidad: stock,
      })
      if (insErr) throw insErr

      return NextResponse.json({
        success: true,
        costo_id: costoId,
        adjusted: true,
        note: `Stock asignado a ${destino.nombre}`,
        stock,
        ubicacion_id: destino.id,
      })
    }

    const sum = filas.reduce((s, f) => s + Math.max(0, Number(f.cantidad ?? 0) || 0), 0)
    const diff = stock - sum
    if (diff === 0) {
      return NextResponse.json({
        success: true,
        costo_id: costoId,
        adjusted: false,
        stock,
        sum,
      })
    }

    const ordenadas = [...filas].sort((a, b) => {
      const ca = Math.max(0, Number(a.cantidad ?? 0) || 0)
      const cb = Math.max(0, Number(b.cantidad ?? 0) || 0)
      if (ca !== cb) return ca - cb
      const ta = isTaller(a.ubicaciones_almacenamiento?.nombre)
      const tb = isTaller(b.ubicaciones_almacenamiento?.nombre)
      if (ta !== tb) return ta ? -1 : 1
      return String(a.ubicacion_almacenamiento_id).localeCompare(
        String(b.ubicacion_almacenamiento_id)
      )
    })

    if (diff > 0) {
      const target = ordenadas[0]
      const cur = Math.max(0, Number(target.cantidad ?? 0) || 0)
      const nueva = cur + diff
      const { error: upErr } = await db
        .from('costo_ubicaciones')
        .update({ cantidad: nueva })
        .eq('id', target.id)
      if (upErr) throw upErr
    } else {
      let rem = -diff
      for (const row of ordenadas) {
        if (rem <= 0) break
        const cur = Math.max(0, Number(row.cantidad ?? 0) || 0)
        const take = Math.min(cur, rem)
        if (take <= 0) continue
        const nueva = cur - take
        // eslint-disable-next-line no-await-in-loop
        const { error: upErr } = await db
          .from('costo_ubicaciones')
          .update({ cantidad: nueva })
          .eq('id', row.id)
        if (upErr) throw upErr
        rem -= take
      }
      if (rem > 0) {
        throw new Error('No alcanzó para descontar el sobrante en ubicaciones.')
      }
    }

    return NextResponse.json({
      success: true,
      costo_id: costoId,
      adjusted: true,
      stock,
      sum_before: sum,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
