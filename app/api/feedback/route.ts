import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ============================================
// SCHEMA DE VALIDACIÓN CON ZOD
// ============================================
const FeedbackSchema = z.object({
  email: z
    .string()
    .email('El email debe tener un formato válido'),
  rating: z
    .number()
    .int('El rating debe ser un número entero')
    .min(1, 'El rating debe ser mínimo 1')
    .max(5, 'El rating debe ser máximo 5'),
  comment: z
    .string()
    .min(10, 'El comentario debe tener al menos 10 caracteres')
    .max(500, 'El comentario no puede exceder 500 caracteres')
    .trim() // Elimina espacios al inicio y final
    .refine((val) => val.length >= 10, {
      message: 'El comentario no puede estar vacío o solo contener espacios',
    }),
});

// Tipo inferido desde Zod (sin usar 'any')
type FeedbackData = z.infer<typeof FeedbackSchema>;

// ============================================
// FUNCIÓN PARA SIMULAR GUARDADO EN BD
// ============================================
async function guardarFeedback(data: FeedbackData): Promise<void> {
  // Simular delay de 500ms
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  // Simular guardado con console.log
  console.log('📝 Feedback guardado:', {
    email: data.email,
    rating: data.rating,
    comment: data.comment,
    timestamp: new Date().toISOString(),
  });
}

// ============================================
// HANDLER POST
// ============================================
export async function POST(request: NextRequest) {
  try {
    // 1. Parsear el body como JSON (maneja JSON malformado)
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'JSON inválido o malformado',
        },
        { status: 400 }
      );
    }

    // 2. Validar con Zod (maneja tipos incorrectos y edge cases)
    const validacion = FeedbackSchema.safeParse(body);

    if (!validacion.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de entrada inválidos',
          detalles: validacion.error.issues.map((issue) => ({
            campo: issue.path.join('.'),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 3. Datos validados
    const feedbackData = validacion.data;

    // 4. Guardar feedback (simulado con console.log + delay)
    await guardarFeedback(feedbackData);

    // 5. Respuesta exitosa
    return NextResponse.json(
      {
        success: true,
        message: 'Feedback recibido correctamente',
        data: {
          email: feedbackData.email,
          rating: feedbackData.rating,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Manejo de errores inesperados
    console.error('Error procesando feedback:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}

// ============================================
// HANDLER PARA MÉTODOS NO PERMITIDOS
// ============================================
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Método no permitido. Use POST.',
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      success: false,
      error: 'Método no permitido. Use POST.',
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: 'Método no permitido. Use POST.',
    },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      error: 'Método no permitido. Use POST.',
    },
    { status: 405 }
  );
}

// ============================================
// EDGE RUNTIME COMPATIBLE
// ============================================
export const runtime = 'edge';
