const fs = require('fs');

const filePath = 'app/reportes/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Reemplazar el botón deshabilitado de ganancias
const oldButton = `            <button className="btn btn-primary" style={{ marginTop: '1rem' }} disabled>
              Próximamente
            </button>`;

const newButton = `            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => handleGenerarReporte('ganancias')}
              disabled={loading}
            >
              {loading ? '⏳ Cargando...' : 'Generar Reporte'}
            </button>`;

content = content.replace(oldButton, newButton);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Botón de ganancias activado');

