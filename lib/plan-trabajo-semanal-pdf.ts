import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type FilaPlanTrabajoPdf = {
  cotizacion: string;
  cliente: string;
  modelo: string;
  piezas: number;
  fechaEntrega: string;
};

/** Abre el plan en una pestaña nueva como PDF (mismo patrón que reportes). */
export function abrirPlanTrabajoSemanalPdf(opts: {
  tituloSemana: string;
  filas: FilaPlanTrabajoPdf[];
  gastosFijos: number;
  gananciasTotal: number;
}): void {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Plan de trabajo — Producción semanal', 14, 18);
  doc.setFontSize(11);
  doc.text(`Semana: ${opts.tituloSemana}`, 14, 26);
  doc.text(`Gastos fijos semanales: $${opts.gastosFijos.toFixed(2)}`, 14, 33);
  doc.text(`Ganancias estimadas (partidas): $${opts.gananciasTotal.toFixed(2)}`, 14, 40);
  doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 14, 47);

  autoTable(doc, {
    startY: 52,
    head: [['Cotización', 'Cliente', 'Modelo', 'Piezas', 'Fecha entrega']],
    body: opts.filas.map((f) => [
      f.cotizacion,
      f.cliente,
      f.modelo,
      String(f.piezas),
      f.fechaEntrega,
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229] },
    columnStyles: { 3: { halign: 'right' } },
  });

  const url = doc.output('bloburl');
  window.open(url, '_blank', 'noopener,noreferrer');
}
