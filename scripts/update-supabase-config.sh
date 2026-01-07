#!/bin/bash
# Script rápido para actualizar configuración de Supabase

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Configuración de Supabase - Obtener Credenciales${NC}"
echo -e "${BLUE}════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}En Supabase Dashboard:${NC}"
echo "1. Ve a: Settings → Database"
echo "2. Busca 'Connection info' o 'Connection string'"
echo "3. Necesitas estos valores:"
echo ""
echo -e "${GREEN}   Host:     db.xxxxx.supabase.co${NC}"
echo -e "${GREEN}   Port:     5432${NC}"
echo -e "${GREEN}   Database: postgres${NC}"
echo -e "${GREEN}   User:     postgres${NC}"
echo -e "${GREEN}   Password: [la que generaste al crear el proyecto]${NC}"
echo ""
echo -e "${YELLOW}Ingresa las credenciales:${NC}"
echo ""

read -p "Host (ej: db.xxxxx.supabase.co): " DB_HOST
read -p "Port [5432]: " DB_PORT
DB_PORT=${DB_PORT:-5432}
read -p "Database name [postgres]: " DB_NAME
DB_NAME=${DB_NAME:-postgres}
read -p "User [postgres]: " DB_USER
DB_USER=${DB_USER:-postgres}
read -sp "Password: " DB_PASSWORD
echo ""

if [ -z "$DB_HOST" ] || [ -z "$DB_PASSWORD" ]; then
    echo "❌ Error: Host y Password son requeridos"
    exit 1
fi

# Backup
if [ -f "terraform/environments/dev.tfvars" ]; then
    cp terraform/environments/dev.tfvars terraform/environments/dev.tfvars.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backup creado"
fi

# Actualizar archivo
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

echo ""
echo -e "${GREEN}✅ Configuración actualizada exitosamente!${NC}"
echo ""
echo -e "${YELLOW}Próximos pasos:${NC}"
echo "1. Verifica: terraform/environments/dev.tfvars"
echo "2. Ejecuta: cd terraform && terraform plan -var-file=\"environments/dev.tfvars\""
echo "3. Si todo está bien: terraform apply -var-file=\"environments/dev.tfvars\""
echo ""
echo -e "${BLUE}⚠️  IMPORTANTE:${NC}"
echo "- El archivo dev.tfvars contiene credenciales sensibles"
echo "- No lo subas a Git (está en .gitignore)"
echo ""

