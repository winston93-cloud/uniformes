#!/bin/bash

echo "🧵 Creando tabla de insumos en Supabase..."
echo ""

# Leer las variables del .env.local
if [ ! -f .env.local ]; then
    echo "❌ No se encontró el archivo .env.local"
    exit 1
fi

# Extraer la URL de Supabase
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d '=' -f2)
PROJECT_REF=$(echo $SUPABASE_URL | sed 's/.*:\/\///' | cut -d '.' -f1)

# Construir la cadena de conexión PostgreSQL
DB_HOST="${PROJECT_REF}.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

echo "📦 Proyecto: $PROJECT_REF"
echo "🔗 Host: $DB_HOST"
echo ""

# Verificar si psql está instalado
if ! command -v psql &> /dev/null; then
    echo "⚠️  psql no está instalado"
    echo ""
    echo "📋 Por favor, ejecuta el SQL manualmente:"
    echo "1. Ve a: https://supabase.com/dashboard/project/$PROJECT_REF/sql"
    echo "2. Copia el contenido de: ./supabase/crear_tabla_insumos.sql"
    echo "3. Pégalo en el SQL Editor y ejecuta"
    echo ""
    exit 1
fi

# Solicitar la contraseña
echo "🔑 Por favor, ingresa la contraseña de la base de datos:"
echo "   (La puedes encontrar en Supabase Dashboard > Settings > Database)"
read -s DB_PASSWORD

if [ -z "$DB_PASSWORD" ]; then
    echo ""
    echo "❌ No se proporcionó contraseña"
    exit 1
fi

echo ""
echo "📝 Ejecutando SQL..."

# Ejecutar el SQL
PGPASSWORD=$DB_PASSWORD psql \
    -h $DB_HOST \
    -p $DB_PORT \
    -U $DB_USER \
    -d $DB_NAME \
    -f ./supabase/crear_tabla_insumos.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Tabla de insumos creada exitosamente!"
    echo ""
    echo "🚀 Ahora puedes usar el módulo de insumos en la aplicación"
else
    echo ""
    echo "❌ Error al crear la tabla"
    echo ""
    echo "📋 Intenta ejecutar el SQL manualmente:"
    echo "   https://supabase.com/dashboard/project/$PROJECT_REF/sql"
fi

