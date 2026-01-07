#!/bin/bash
# Script para configurar Supabase y actualizar Terraform

set -e

echo "🚀 Configuración de Supabase para SaveIt App"
echo "=============================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "terraform/environments/dev.tfvars" ]; then
    echo -e "${RED}Error: Ejecuta este script desde la raíz del proyecto${NC}"
    exit 1
fi

echo -e "${YELLOW}Paso 1: Crear cuenta y proyecto en Supabase${NC}"
echo ""
echo "1. Ve a https://supabase.com/"
echo "2. Haz clic en 'Start your project' o 'Sign up'"
echo "3. Crea una cuenta (puedes usar GitHub, Google, etc.)"
echo "4. Haz clic en 'New Project'"
echo "5. Completa:"
echo "   - Name: saveit-app-dev"
echo "   - Database Password: (genera una segura y GUÁRDALA)"
echo "   - Region: US East (N. Virginia)"
echo "   - Pricing Plan: Free"
echo "6. Haz clic en 'Create new project'"
echo ""
read -p "Presiona Enter cuando hayas creado el proyecto..."

echo ""
echo -e "${YELLOW}Paso 2: Obtener credenciales${NC}"
echo ""
echo "1. En Supabase, ve a Settings → Database"
echo "2. Busca 'Connection info' o 'Connection string'"
echo "3. Necesitamos:"
echo "   - Host (ej: db.xxxxx.supabase.co)"
echo "   - Port (5432)"
echo "   - Database name (postgres)"
echo "   - User (postgres)"
echo "   - Password (la que generaste)"
echo ""

read -p "Ingresa el HOST (ej: db.xxxxx.supabase.co): " DB_HOST
read -p "Ingresa el PORT [5432]: " DB_PORT
DB_PORT=${DB_PORT:-5432}
read -p "Ingresa el DATABASE NAME [postgres]: " DB_NAME
DB_NAME=${DB_NAME:-postgres}
read -p "Ingresa el USER [postgres]: " DB_USER
DB_USER=${DB_USER:-postgres}
read -sp "Ingresa el PASSWORD: " DB_PASSWORD
echo ""

# Validar que todos los campos estén llenos
if [ -z "$DB_HOST" ] || [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Error: Host y Password son requeridos${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Paso 3: Actualizar terraform/environments/dev.tfvars${NC}"

# Backup del archivo original
cp terraform/environments/dev.tfvars terraform/environments/dev.tfvars.backup

# Actualizar el archivo
cat > terraform/environments/dev.tfvars << EOF
# Development Environment Configuration
# AWS Free Tier optimized settings

aws_region   = "us-east-1"
environment  = "dev"
project_name = "saveit"

# Database Configuration
# Using external database (Supabase) to avoid RDS Free Tier limit
use_external_database = true
external_database_host = "${DB_HOST}"
external_database_port = ${DB_PORT}
external_database_name = "${DB_NAME}"
external_database_user = "${DB_USER}"
external_database_password = "${DB_PASSWORD}"
external_database_secret_name = "" # Opcional: usar Secrets Manager

# EC2 Configuration (Free Tier)
# 750 hours/month t3.micro free for 12 months
ec2_instance_type    = "t3.micro"
ec2_root_volume_size = 20

# SSH Access
# IMPORTANT: Change to your IP address for security
ssh_cidr_blocks = ["0.0.0.0/0"]

# SSH Key Configuration
# Option 1: Use existing key pair
existing_ssh_key_name = "saveit-dev-key" # Using existing key

# Option 2: Create new key pair (set create_ssh_key_pair = true)
create_ssh_key_pair = false
ssh_public_key      = "" # Paste your public key here if creating new

# Elastic IP (Optional - costs ~\$0.005/hour when not attached)
create_elastic_ip = false

# Redis Configuration
# Use external Redis (Upstash free tier) to avoid ElastiCache costs
# 
# PASOS PARA CONFIGURAR UPSTASH (GRATIS):
# 1. Crear cuenta en https://upstash.com (gratis)
# 2. Crear nueva Redis database
# 3. Seleccionar región cercana a us-east-1
# 4. Copiar el endpoint Redis (formato: redis://default:PASSWORD@ENDPOINT.upstash.io:6379)
# 5. Pegar aquí abajo
#
# Free Tier incluye:
# - 10,000 comandos/día
# - 256 MB memoria
# - SSL/TLS incluido
# - Sin límite de tiempo
#
redis_endpoint_url = "" # Ejemplo: "redis://default:AbCd1234@redis-12345.upstash.io:6379"

# Application Repository
# Git repository URL for automatic deployment
app_repository_url = "https://github.com/clementeaf/saveit-app.git"

# Container
container_port = 3001

# Monitoring
enable_monitoring = true

# Tags
tags = {
  CostCenter  = "Development"
  Owner       = "DevTeam"
  Environment = "dev"
  Terraform   = "true"
  FreeTier    = "true"
}
EOF

echo -e "${GREEN}✅ Archivo actualizado exitosamente!${NC}"
echo ""
echo "Backup guardado en: terraform/environments/dev.tfvars.backup"
echo ""

# Opcional: Guardar en Secrets Manager
echo -e "${YELLOW}¿Deseas guardar las credenciales en AWS Secrets Manager? (más seguro) [y/N]${NC}"
read -p "> " USE_SECRETS

if [[ "$USE_SECRETS" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Creando secret en AWS Secrets Manager..."
    
    SECRET_NAME="saveit-dev-external-db-credentials"
    SECRET_JSON=$(cat << EOF
{
  "host": "${DB_HOST}",
  "port": "${DB_PORT}",
  "name": "${DB_NAME}",
  "user": "${DB_USER}",
  "password": "${DB_PASSWORD}"
}
EOF
)
    
    # Intentar crear el secret
    aws secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --secret-string "$SECRET_JSON" \
        --region us-east-1 2>/dev/null || \
    aws secretsmanager update-secret \
        --secret-id "$SECRET_NAME" \
        --secret-string "$SECRET_JSON" \
        --region us-east-1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Secret creado/actualizado en AWS Secrets Manager${NC}"
        
        # Actualizar dev.tfvars para usar el secret
        sed -i.bak "s/external_database_secret_name = \"\"/external_database_secret_name = \"${SECRET_NAME}\"/" terraform/environments/dev.tfvars
        sed -i.bak "s/external_database_password = \".*\"/external_database_password = \"\"/" terraform/environments/dev.tfvars
        rm -f terraform/environments/dev.tfvars.bak
        
        echo -e "${GREEN}✅ dev.tfvars actualizado para usar Secrets Manager${NC}"
    else
        echo -e "${RED}⚠️  Error al crear secret. Usando contraseña directa en dev.tfvars${NC}"
    fi
fi

echo ""
echo -e "${GREEN}=============================================="
echo "✅ Configuración completada!"
echo "=============================================="
echo ""
echo "Próximos pasos:"
echo "1. Verifica que terraform/environments/dev.tfvars tenga las credenciales correctas"
echo "2. Ejecuta: cd terraform && terraform plan -var-file=\"environments/dev.tfvars\""
echo "3. Si todo está bien: terraform apply -var-file=\"environments/dev.tfvars\""
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "- El archivo dev.tfvars contiene credenciales sensibles"
echo "- No lo subas a Git (debería estar en .gitignore)"
echo "- Considera usar Secrets Manager para producción"
echo ""

