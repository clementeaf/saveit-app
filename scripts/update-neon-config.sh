#!/bin/bash
# Script para actualizar configuración con Neon

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Configuración de Neon PostgreSQL${NC}"
echo -e "${BLUE}════════════════════════════════════════════════${NC}"
echo ""

read -p "Pega la connection string de Neon: " CONNECTION_STRING

if [ -z "$CONNECTION_STRING" ]; then
    echo "❌ Connection string vacía"
    exit 1
fi

# Extraer componentes de la connection string
# Formato: postgresql://user:password@host:port/database
DB_HOST=$(echo "$CONNECTION_STRING" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$CONNECTION_STRING" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_PORT=${DB_PORT:-5432}
DB_NAME=$(echo "$CONNECTION_STRING" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$CONNECTION_STRING" | sed -n 's/postgresql:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo "$CONNECTION_STRING" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo "❌ Error extrayendo credenciales de la connection string"
    echo "Formato esperado: postgresql://user:password@host:port/database"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Credenciales extraídas:${NC}"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Actualizar terraform/environments/dev.tfvars
if [ -f "terraform/environments/dev.tfvars" ]; then
    cp terraform/environments/dev.tfvars terraform/environments/dev.tfvars.backup.$(date +%Y%m%d_%H%M%S)
    
    # Actualizar valores
    sed -i.bak "s|external_database_host = \".*\"|external_database_host = \"$DB_HOST\"|" terraform/environments/dev.tfvars
    sed -i.bak "s|external_database_port = [0-9]*|external_database_port = $DB_PORT|" terraform/environments/dev.tfvars
    sed -i.bak "s|external_database_name = \".*\"|external_database_name = \"$DB_NAME\"|" terraform/environments/dev.tfvars
    sed -i.bak "s|external_database_user = \".*\"|external_database_user = \"$DB_USER\"|" terraform/environments/dev.tfvars
    sed -i.bak "s|external_database_password = \".*\"|external_database_password = \"$DB_PASSWORD\"|" terraform/environments/dev.tfvars
    
    rm -f terraform/environments/dev.tfvars.bak
    
    echo -e "${GREEN}✅ terraform/environments/dev.tfvars actualizado${NC}"
fi

echo ""
echo -e "${YELLOW}Próximos pasos:${NC}"
echo "1. Verifica: terraform/environments/dev.tfvars"
echo "2. Actualiza EC2: ssh a la instancia y actualiza .env"
echo "3. Ejecuta migraciones: npm run db:migrate"
echo "4. Inicia aplicación"
echo ""

