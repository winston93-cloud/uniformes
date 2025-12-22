const fs = require('fs');

const filePath = 'app/reportes/page.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Caso ganancias
const gananciasCase = `
        case 'ganancias':
          if (!periodo.fechaInicio || !periodo.fechaFin) {
            alert('Selecciona las fechas del período');
            return;
          }
          const reporteGanancias = await ingresosYGanancias(periodo.fechaInicio, periodo.fechaFin);
          if (!reporteGanancias || reporteGanancias.totalVentas === 0) {
            alert('No hay datos de ventas para el período seleccionado');
            return;
          }
          generarPDFGanancias(reporteGanancias);
          break;`;

// Insertar después del break de clientes (línea 297)
lines.splice(297, 0, gananciasCase);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('✅ Caso ganancias agregado al switch');

