# Development Environment Configuration
# AWS Free Tier optimized settings

aws_region   = "us-east-1"
environment  = "dev"
project_name = "saveit"

# RDS PostgreSQL Configuration (Free Tier)
# 750 hours/month db.t3.micro + 20GB storage free for 12 months
db_instance_class     = "db.t3.micro"
db_allocated_storage  = 20
db_engine_version     = "15"

# EC2 Configuration (Free Tier)
# 750 hours/month t3.micro free for 12 months
ec2_instance_type    = "t3.micro"
ec2_root_volume_size = 20

# SSH Access
# IMPORTANT: Change to your IP address for security
ssh_cidr_blocks = ["0.0.0.0/0"]

# SSH Key Configuration
# Option 1: Use existing key pair
existing_ssh_key_name = null # Set to your existing key name

# Option 2: Create new key pair (set create_ssh_key_pair = true)
create_ssh_key_pair = false
ssh_public_key      = "" # Paste your public key here if creating new

# Elastic IP (Optional - costs ~$0.005/hour when not attached)
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
app_repository_url = "" # Example: "https://github.com/your-org/saveit-app.git"

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
