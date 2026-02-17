CONTRATO: API de Feedback Seguro (v1.0)

Objetivo: Crear un endpoint robusto para capturar feedback de usuarios en una app Next.js desplegada en Vercel.
🛠️ Stack Tecnológico (Restricciones)

    Framework: Next.js 14+ (App Router).

    Lenguaje: TypeScript (Strict Mode).

    Validación: Zod.

    Deployment: Vercel (Edge Runtime preferido).

🎯 Requisitos Funcionales (El "Qué")

    Endpoint: POST /api/feedback.

    Payload: Debe aceptar un JSON con:

        email: String (formato email válido).

        rating: Number (entero del 1 al 5).

        comment: String (mínimo 10, máximo 500 caracteres).

    Respuesta: * 201 Created si es exitoso.

        400 Bad Request si la validación falla (con mensajes claros).

    Persistencia: Simular guardado con un console.log y un delay de 500ms (Promesa).

🛡️ Criterios de Aceptación del Coach (El "Cómo")

El Coach rechazará la implementación si falta cualquiera de estos:

    Validación de Tipos: ¿Se usa Zod para parsear el body? No se permiten tipos any.

    Manejo de Errores: ¿Qué pasa si el JSON está mal formado? Debe devolver un error elegante, no un crash 500.

    Seguridad Básica: El endpoint debe validar que el método sea estrictamente POST.

    Edge Cases: * ¿Qué pasa si el comment tiene puros espacios en blanco?

        ¿Qué pasa si el rating es 6 o 0?

    Optimización Vercel: El código debe estar listo para ejecutarse en el Edge Runtime (evitar librerías pesadas de Node.js si no son necesarias).

🚦 Protocolo de Turnos

    Turno 1 (Player): Implementar la estructura básica.

    Turno 2 (Coach): Ejecutar revisión contra los "Criterios de Aceptación".

    Turno 3+: Refinamiento hasta que el Coach diga: "APROBADO PARA DEPLOY".

💡 Cómo usar este contrato ahora mismo:

    En Cursor (Player): Abre un nuevo chat, pega este contrato y dile: "Actúa como el Player. Implementa el código siguiendo este contrato estrictamente."

    En una ventana nueva o con otro modelo (Coach): Pega el código que generó Cursor y dile: "Actúa como el Coach. Revisa este código basándote ÚNICAMENTE en los 'Criterios de Aceptación' del contrato. Sé despiadado y lista los fallos."
