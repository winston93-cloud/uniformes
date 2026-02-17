const fs = require('fs');

const filePath = 'app/reportes/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Buscar el caso de 'clientes' y agregar después el caso de 'ganancias'
const clientesCase = `        case 'clientes':
          datos = await clientesFrecuentes();
          if (datos.length === 0) {
            alert('No hay datos de clientes');
            return;
          }
          generarPDFClientes(datos);
          break;`;

const gananciasCase = `        case 'clientes':
          datos = await clientesFrecuentes();
          if (datos.length === 0) {
            alert('No hay datos de clientes');
            return;
          }
          generarPDFClientes(datos);
          break;

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

content = content.replace(clientesCase, gananciasCase);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Caso ganancias agregado al switch');

