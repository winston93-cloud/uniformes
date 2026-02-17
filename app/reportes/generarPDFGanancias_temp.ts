// Función temporal para generar PDF de Ingresos y Ganancias
// Se agregará a page.tsx

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReporteGanancias } from '@/lib/hooks/useReportes';

export const generarPDFGanancias = (datos: ReporteGanancias) => {
  const doc = new jsPDF();
  
  // Encabezado
  doc.setFontSize(18);
  doc.text('Reporte de Ingresos y Ganancias', 14, 20);
  
  doc.setFontSize(11);
  doc.text(`Periodo: ${datos.periodo}`, 14, 30);
  doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-MX')}`, 14, 36);
  
  // Resumen general
  doc.setFontSize(14);
  doc.text('Resumen', 14, 46);
  
  const resumenData = [
    ['Total Ventas', `$${datos.totalVentas.toFixed(2)}`],
    ['Total Costos', `$${datos.totalCostos.toFixed(2)}`],
    ['Ganancia Neta', `$${datos.ganancia.toFixed(2)}`],
    ['Margen de Ganancia', `${datos.margen.toFixed(2)}%`],
  ];
  
  autoTable(doc, {
    startY: 50,
    head: [['Concepto', 'Monto']],
    body: resumenData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 80, halign: 'right' },
    },
  });
  
  // Detalles por prenda
  const finalY = (doc as any).lastAutoTable.finalY || 90;
  doc.setFontSize(14);
  doc.text('Detalle por Prenda', 14, finalY + 10);
  
  const detalleData = datos.detalles.map((d) => [
    d.prenda,
    d.talla,
    d.cantidad.toString(),
    `$${d.ingresos.toFixed(2)}`,
    `$${d.costos.toFixed(2)}`,
    `$${d.ganancia.toFixed(2)}`,
    d.ingresos > 0 ? `${((d.ganancia / d.ingresos) * 100).toFixed(1)}%` : '0%',
  ]);
  
  autoTable(doc, {
    startY: finalY + 15,
    head: [['Prenda', 'Talla', 'Cant.', 'Ingresos', 'Costos', 'Ganancia', 'Margen']],
    body: detalleData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 20 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
    },
  });
  
  // Abrir en nueva pestaña
  window.open(doc.output('bloburl'), '_blank');
};

