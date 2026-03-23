# Concepto de diseño — Deep redesign
## Sistema de Uniformes Winston Churchill · Nivel Dribbble/Behance

### Inspiración y estilo elegido

**Estilo: Liquid Glass + Premium SaaS**

Inspirado en paneles como Linear, Vercel y Stripe Dashboard:

- **Glassmorphism refinado:** Fondos translúcidos con `backdrop-filter`, bordes suaves y sombras ligeras.
- **Paleta premium:** Negro/stone (#0C0A09, #1C1917) con acento dorado (#CA8A04) para sensación institucional y de calidad.
- **Tipografía:** Outfit (títulos) + DM Sans (cuerpo) para equilibrio entre personalidad y legibilidad.

### Justificación de cada mejora

| Elemento | Mejora | Razón UX/UI |
|----------|--------|-------------|
| **Header** | Avatar con inicial del usuario | Reforzar identidad y contexto de sesión |
| **Calendario** | Semana actual con fechas reales | Información útil desde el primer vistazo |
| **KPIs** | Mini gráfico de barras animado | Anticipa métricas futuras y da sensación de producto vivo |
| **Tarjetas** | Borde superior de color + hover elevado | Jerarquía visual y feedback inmediato |
| **Tema** | Toggle oscuro/claro | Preferencia de usuario y comodidad visual |
| **Animaciones** | Framer Motion con stagger | Entrada fluida y percepción de fluidez |
| **Badge** | Estilo premium con sombra | Refuerza estado “En desarrollo” sin sensación de inacabado |

### Stack técnico

- **Next.js 16** (App Router)
- **Framer Motion** para animaciones
- **Lucide React** para iconos SVG
- **Vercel Analytics + Speed Insights** para métricas
- **CSS Modules** con variables para tema

### Instrucciones de despliegue en Vercel

1. Conectar el repositorio a Vercel.
2. Configurar variables de entorno (Supabase, etc.).
3. Deploy automático en cada push a `main`.
4. Analytics y Speed Insights se habilitan al vincular el proyecto.
