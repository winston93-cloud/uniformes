# Design System — Módulo Producción Semanal
## UI UX PRO MAX · Sistema Uniformes Winston Churchill

### 1. Estilo visual: Claymorphism

**Justificación:** Recomendado por UI UX PRO MAX para "Educational apps, SaaS platforms, creative tools". El sistema de uniformes escolares es administrativo-educativo. Claymorphism transmite:
- **Confianza:** Bordes gruesos (3-4px) y sombras suaves
- **Accesibilidad:** Formas redondeadas (16-24px)
- **Modernidad:** Efecto soft 3D sin complejidad

**Características:** Double shadows, inner+outer, transiciones 200ms ease-out.

---

### 2. Paleta de colores (Hex)

| Rol | Hex | Uso |
|-----|-----|-----|
| Primary | `#6366F1` | Acciones principales, marca |
| Secondary | `#818CF8` | Hover, acentos secundarios |
| CTA/Éxito | `#10B981` | Entrada, confirmaciones |
| Background | `#F5F3FF` | Fondo panel principal |
| Text | `#1E1B4B` | Texto principal (contraste 4.5:1) |
| Text muted | `#64748B` | Subtítulos, labels |
| Acento Salida | `#F59E0B` | Tarjeta Salida, alertas |
| Border | `#E2E8F0` | Bordes cards |

---

### 3. Tipografía

- **Heading:** Fira Sans 700 (títulos, cards)
- **Body:** Fira Sans 400 (cuerpo, descripciones)
- **Labels:** Fira Sans 600 (KPIs, badges)

Google Fonts: `Fira+Sans:wght@400;600;700`

---

### 4. Principios UX aplicados

- **WCAG AA:** Contraste mínimo 4.5:1 en texto
- **Focus visible:** Outline 2px en elementos interactivos
- **Hover feedback:** Transición 200ms, elevación sutil
- **cursor-pointer:** En todos los elementos clickeables
- **prefers-reduced-motion:** Desactivar animaciones si el usuario lo indica
- **Responsive:** Breakpoints 375, 768, 1024, 1440px
