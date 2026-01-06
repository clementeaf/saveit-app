# SaveIt App - Estructura Terraform para AWS

## Visión General

Esta guía describe la estructura completa de Terraform para gestionar la infraestructura de SaveIt App en AWS, siguiendo mejores prácticas de Infrastructure as Code (IaC).

---

## Estructura de Directorios

```
saveit-app/
├── terraform/
│   ├── environments/
│   │   ├── dev/
│   │   │   ├── main.tf
│   │   │   ├── terraform.tfvars
│   │   │   └── backend.tf
│   │   ├── staging/
│   │   │   ├── main.tf
│   │   │   ├── terraform.tfvars
│   │   │   └── backend.tf
│   │   └── prod/
│   │       ├── main.tf
│   │       ├── terraform.tfvars
│   │       └── backend.tf
│   │
│   ├── modules/
│   │   ├── vpc/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── README.md
│   │   │
│   │   ├── rds/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── README.md
│   │   │
│   │   ├── elasticache/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── README.md
│   │   │
│   │   ├── ecs/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── README.md
│   │   │
│   │   ├── lambda/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── README.md
│   │   │
│   │   ├── api-gateway/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── README.md
│   │   │
│   │   ├── eventbridge/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── README.md
│   │   │
│   │   ├── s3/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── README.md
│   │   │
│   │   ├── cloudfront/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── README.md
│   │   │
│   │   ├── monitoring/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── README.md
│   │   │
│   │   └── security/
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       ├── outputs.tf
│   │       └── README.md
│   │
│   ├── scripts/
│   │   ├── init.sh
│   │   ├── plan.sh
│   │   ├── apply.sh
│   │   └── destroy.sh
│   │
│   └── README.md
│
├── ARQUITECTURA.md
├── GARANTIAS_SINCRONIZACION.md
└── TERRAFORM_STRUCTURE.md
```

---

## Configuración Inicial

### 1. Backend Configuration (S3 + DynamoDB)

```hcl
# terraform/environments/prod/backend.tf

terraform {
  backend "s3" {
    bucket         = "saveit-terraform-state-prod"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "saveit-terraform-locks"
    
    # Versionado para rollback
    versioning = true
  }
  
  required_version = ">= 1.6.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}
```

### 2. Provider Configuration

```hcl
# terraform/environments/prod/main.tf

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "SaveIt"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "Engineering"
      CostCenter  = "Reservations"
    }
  }
}

# Variables principales
variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "saveit"
}
```

---

## Módulos Terraform

### Module 1: VPC (Networking)

```hcl
# terraform/modules/vpc/main.tf

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "${var.project_name}-${var.environment}-vpc"
  }
}

# Public Subnets (para ALB, NAT Gateway)
resource "aws_subnet" "public" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone = var.availability_zones[count.index]
  
  map_public_ip_on_launch = true
  
  tags = {
    Name = "${var.project_name}-${var.environment}-public-${var.availability_zones[count.index]}"
    Type = "Public"
  }
}

# Private Subnets (para ECS, RDS, Lambda)
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = var.availability_zones[count.index]
  
  tags = {
    Name = "${var.project_name}-${var.environment}-private-${var.availability_zones[count.index]}"
    Type = "Private"
  }
}

# Database Subnets (aisladas)
resource "aws_subnet" "database" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 20)
  availability_zone = var.availability_zones[count.index]
  
  tags = {
    Name = "${var.project_name}-${var.environment}-db-${var.availability_zones[count.index]}"
    Type = "Database"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = {
    Name = "${var.project_name}-${var.environment}-igw"
  }
}

# NAT Gateway (Multi-AZ para HA)
resource "aws_eip" "nat" {
  count  = length(var.availability_zones)
  domain = "vpc"
  
  tags = {
    Name = "${var.project_name}-${var.environment}-nat-eip-${count.index + 1}"
  }
}

resource "aws_nat_gateway" "main" {
  count         = length(var.availability_zones)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  
  tags = {
    Name = "${var.project_name}-${var.environment}-nat-${count.index + 1}"
  }
  
  depends_on = [aws_internet_gateway.main]
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-public-rt"
  }
}

resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-private-rt-${count.index + 1}"
  }
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# VPC Endpoints (reducir costos de NAT)
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.aws_region}.s3"
  
  route_table_ids = concat(
    [aws_route_table.public.id],
    aws_route_table.private[*].id
  )
  
  tags = {
    Name = "${var.project_name}-${var.environment}-s3-endpoint"
  }
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.aws_region}.dynamodb"
  
  route_table_ids = concat(
    [aws_route_table.public.id],
    aws_route_table.private[*].id
  )
  
  tags = {
    Name = "${var.project_name}-${var.environment}-dynamodb-endpoint"
  }
}
```

```hcl
# terraform/modules/vpc/variables.tf

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}
```

```hcl
# terraform/modules/vpc/outputs.tf

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "Database subnet IDs"
  value       = aws_subnet.database[*].id
}

output "nat_gateway_ids" {
  description = "NAT Gateway IDs"
  value       = aws_nat_gateway.main[*].id
}
```

---

### Module 2: RDS PostgreSQL

```hcl
# terraform/modules/rds/main.tf

# Subnet Group para Multi-AZ
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-db-subnet-group"
  subnet_ids = var.database_subnet_ids
  
  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

# Security Group para RDS
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = var.vpc_id
  
  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }
  
  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  }
}

# Parameter Group (optimizado para transacciones)
resource "aws_db_parameter_group" "main" {
  name   = "${var.project_name}-${var.environment}-pg15"
  family = "postgres15"
  
  # Optimizaciones para ACID y concurrencia
  parameter {
    name  = "max_connections"
    value = "1000"
  }
  
  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/4096}" # 25% de RAM
  }
  
  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory/2048}" # 50% de RAM
  }
  
  parameter {
    name  = "maintenance_work_mem"
    value = "2097152" # 2GB
  }
  
  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }
  
  parameter {
    name  = "wal_buffers"
    value = "16384" # 16MB
  }
  
  parameter {
    name  = "default_statistics_target"
    value = "100"
  }
  
  parameter {
    name  = "random_page_cost"
    value = "1.1" # Para SSD
  }
  
  parameter {
    name  = "effective_io_concurrency"
    value = "200"
  }
  
  parameter {
    name  = "work_mem"
    value = "10485760" # 10MB por operación
  }
  
  # Aislamiento SERIALIZABLE por defecto
  parameter {
    name  = "default_transaction_isolation"
    value = "serializable"
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-pg-params"
  }
}

# RDS Instance (Multi-AZ)
resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-${var.environment}-postgres"
  
  # Engine
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = var.instance_class
  
  # Storage
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = var.kms_key_id
  iops                 = var.iops
  
  # Database
  db_name  = var.database_name
  username = var.master_username
  password = var.master_password # Usar AWS Secrets Manager
  port     = 5432
  
  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  
  # Multi-AZ para HA
  multi_az = true
  
  # Backups
  backup_retention_period   = var.backup_retention_days
  backup_window            = "03:00-04:00" # UTC
  maintenance_window       = "mon:04:00-mon:05:00"
  
  # Monitoring
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  monitoring_interval             = 60
  monitoring_role_arn            = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled   = true
  performance_insights_retention_period = 7
  
  # Parameter Group
  parameter_group_name = aws_db_parameter_group.main.name
  
  # Snapshot
  skip_final_snapshot       = var.environment != "prod"
  final_snapshot_identifier = "${var.project_name}-${var.environment}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  
  # Protection
  deletion_protection = var.environment == "prod"
  
  # Auto minor version upgrade
  auto_minor_version_upgrade = true
  
  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }
}

# Read Replicas (para queries de lectura)
resource "aws_db_instance" "read_replica" {
  count = var.read_replica_count
  
  identifier = "${var.project_name}-${var.environment}-postgres-replica-${count.index + 1}"
  
  # Replica configuration
  replicate_source_db = aws_db_instance.main.identifier
  instance_class      = var.replica_instance_class
  
  # Storage
  storage_encrypted = true
  
  # Network
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  
  # Monitoring
  monitoring_interval    = 60
  monitoring_role_arn   = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = true
  
  # Snapshot
  skip_final_snapshot = true
  
  # Auto minor version upgrade
  auto_minor_version_upgrade = true
  
  tags = {
    Name = "${var.project_name}-${var.environment}-postgres-replica-${count.index + 1}"
  }
}

# IAM Role para Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.project_name}-${var.environment}-rds-monitoring-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# RDS Proxy (connection pooling)
resource "aws_db_proxy" "main" {
  name                   = "${var.project_name}-${var.environment}-rds-proxy"
  engine_family          = "POSTGRESQL"
  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = var.db_secret_arn
  }
  
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = var.database_subnet_ids
  require_tls            = true
  
  tags = {
    Name = "${var.project_name}-${var.environment}-rds-proxy"
  }
}

resource "aws_db_proxy_default_target_group" "main" {
  db_proxy_name = aws_db_proxy.main.name
  
  connection_pool_config {
    max_connections_percent      = 100
    max_idle_connections_percent = 50
    connection_borrow_timeout    = 120
  }
}

resource "aws_db_proxy_target" "main" {
  db_proxy_name          = aws_db_proxy.main.name
  target_group_name      = aws_db_proxy_default_target_group.main.name
  db_instance_identifier = aws_db_instance.main.identifier
}

# IAM Role para RDS Proxy
resource "aws_iam_role" "rds_proxy" {
  name = "${var.project_name}-${var.environment}-rds-proxy-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "rds_proxy_secrets" {
  name = "${var.project_name}-${var.environment}-rds-proxy-secrets-policy"
  role = aws_iam_role.rds_proxy.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetResourcePolicy",
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:ListSecretVersionIds"
        ]
        Resource = var.db_secret_arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = var.kms_key_id
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}
```

```hcl
# terraform/modules/rds/variables.tf

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "database_subnet_ids" {
  description = "Database subnet IDs"
  type        = list(string)
}

variable "allowed_security_groups" {
  description = "Security groups allowed to connect"
  type        = list(string)
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "allocated_storage" {
  description = "Initial storage in GB"
  type        = number
  default     = 100
}

variable "max_allocated_storage" {
  description = "Maximum storage in GB (autoscaling)"
  type        = number
  default     = 1000
}

variable "iops" {
  description = "IOPS for gp3"
  type        = number
  default     = 3000
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "saveit"
}

variable "master_username" {
  description = "Master username"
  type        = string
  sensitive   = true
}

variable "master_password" {
  description = "Master password"
  type        = string
  sensitive   = true
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
}

variable "backup_retention_days" {
  description = "Backup retention period"
  type        = number
  default     = 7
}

variable "read_replica_count" {
  description = "Number of read replicas"
  type        = number
  default     = 2
}

variable "replica_instance_class" {
  description = "Read replica instance class"
  type        = string
  default     = "db.r6g.large"
}

variable "db_secret_arn" {
  description = "ARN of database secret"
  type        = string
}
```

```hcl
# terraform/modules/rds/outputs.tf

output "db_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "db_instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.main.id
}

output "db_proxy_endpoint" {
  description = "RDS Proxy endpoint"
  value       = aws_db_proxy.main.endpoint
}

output "db_security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}

output "read_replica_endpoints" {
  description = "Read replica endpoints"
  value       = aws_db_instance.read_replica[*].endpoint
}
```

---

### Module 3: ElastiCache Redis

```hcl
# terraform/modules/elasticache/main.tf

# Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids
  
  tags = {
    Name = "${var.project_name}-${var.environment}-redis-subnet-group"
  }
}

# Security Group
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-${var.environment}-redis-sg"
  description = "Security group for Redis cluster"
  vpc_id      = var.vpc_id
  
  ingress {
    description     = "Redis from ECS/Lambda"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }
  
  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-redis-sg"
  }
}

# Parameter Group (optimizado para locks y cache)
resource "aws_elasticache_parameter_group" "main" {
  name   = "${var.project_name}-${var.environment}-redis7"
  family = "redis7"
  
  # Timeouts para locks
  parameter {
    name  = "timeout"
    value = "300" # 5 minutos
  }
  
  # Notificaciones de eventos
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex" # Eventos de expiración
  }
  
  # Política de evicción (no evict para locks)
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-redis-params"
  }
}

# Replication Group (Cluster Mode con Multi-AZ)
resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${var.project_name}-${var.environment}-redis"
  replication_group_description = "Redis cluster for SaveIt ${var.environment}"
  
  # Engine
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.node_type
  
  # Cluster configuration
  num_cache_clusters         = var.num_cache_nodes
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  # Network
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]
  port               = 6379
  
  # Parameter Group
  parameter_group_name = aws_elasticache_parameter_group.main.name
  
  # Encryption
  at_rest_encryption_enabled = true
  kms_key_id                 = var.kms_key_id
  transit_encryption_enabled = true
  auth_token_enabled        = true
  auth_token                = var.redis_auth_token
  
  # Snapshots
  snapshot_retention_limit = var.snapshot_retention_days
  snapshot_window         = "03:00-05:00" # UTC
  maintenance_window      = "mon:05:00-mon:07:00"
  
  # Notifications
  notification_topic_arn = var.sns_topic_arn
  
  # Auto-upgrade
  auto_minor_version_upgrade = true
  
  # Logs
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }
  
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_engine_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-redis"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/${var.project_name}-${var.environment}/slow-log"
  retention_in_days = 7
  
  tags = {
    Name = "${var.project_name}-${var.environment}-redis-slow-log"
  }
}

resource "aws_cloudwatch_log_group" "redis_engine_log" {
  name              = "/aws/elasticache/${var.project_name}-${var.environment}/engine-log"
  retention_in_days = 7
  
  tags = {
    Name = "${var.project_name}-${var.environment}-redis-engine-log"
  }
}
```

```hcl
# terraform/modules/elasticache/variables.tf

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs"
  type        = list(string)
}

variable "allowed_security_groups" {
  description = "Security groups allowed to connect"
  type        = list(string)
}

variable "node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 3
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
}

variable "redis_auth_token" {
  description = "Redis authentication token"
  type        = string
  sensitive   = true
}

variable "snapshot_retention_days" {
  description = "Snapshot retention period"
  type        = number
  default     = 5
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for notifications"
  type        = string
}
```

```hcl
# terraform/modules/elasticache/outputs.tf

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Redis reader endpoint"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_security_group_id" {
  description = "Redis security group ID"
  value       = aws_security_group.redis.id
}
```

---

## Uso de los Módulos

### Production Environment

```hcl
# terraform/environments/prod/main.tf

module "vpc" {
  source = "../../modules/vpc"
  
  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

module "rds" {
  source = "../../modules/rds"
  
  project_name            = var.project_name
  environment             = var.environment
  aws_region              = var.aws_region
  vpc_id                  = module.vpc.vpc_id
  database_subnet_ids     = module.vpc.database_subnet_ids
  allowed_security_groups = [module.ecs.ecs_security_group_id]
  
  instance_class         = "db.r6g.xlarge"
  allocated_storage      = 200
  max_allocated_storage  = 1000
  database_name          = "saveit_prod"
  master_username        = var.db_master_username
  master_password        = var.db_master_password
  kms_key_id            = module.security.kms_key_id
  backup_retention_days  = 30
  read_replica_count     = 2
  db_secret_arn         = module.security.db_secret_arn
}

module "elasticache" {
  source = "../../modules/elasticache"
  
  project_name            = var.project_name
  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  allowed_security_groups = [module.ecs.ecs_security_group_id, module.lambda.lambda_security_group_id]
  
  node_type              = "cache.r6g.large"
  num_cache_nodes        = 3
  kms_key_id            = module.security.kms_key_id
  redis_auth_token      = var.redis_auth_token
  snapshot_retention_days = 5
  sns_topic_arn         = module.monitoring.sns_topic_arn
}

# ... otros módulos (ECS, Lambda, API Gateway, etc.)
```

```hcl
# terraform/environments/prod/terraform.tfvars

aws_region   = "us-east-1"
environment  = "prod"
project_name = "saveit"

# DB credentials (usar AWS Secrets Manager en producción)
db_master_username = "saveit_admin"
# db_master_password se pasa como variable de entorno

# Redis auth token
# redis_auth_token se pasa como variable de entorno
```

---

## Scripts de Automatización

### Init Script

```bash
#!/bin/bash
# terraform/scripts/init.sh

set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: ./init.sh <environment>"
  echo "Example: ./init.sh prod"
  exit 1
fi

cd "$(dirname "$0")/../environments/$ENVIRONMENT"

echo "Initializing Terraform for $ENVIRONMENT..."
terraform init -upgrade

echo "Validating configuration..."
terraform validate

echo "Formatting code..."
terraform fmt -recursive

echo "✅ Terraform initialized successfully for $ENVIRONMENT"
```

### Plan Script

```bash
#!/bin/bash
# terraform/scripts/plan.sh

set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: ./plan.sh <environment>"
  exit 1
fi

cd "$(dirname "$0")/../environments/$ENVIRONMENT"

echo "Planning Terraform changes for $ENVIRONMENT..."
terraform plan -out=tfplan

echo "✅ Plan saved to tfplan"
echo "Review the plan above, then run: ./apply.sh $ENVIRONMENT"
```

### Apply Script

```bash
#!/bin/bash
# terraform/scripts/apply.sh

set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: ./apply.sh <environment>"
  exit 1
fi

cd "$(dirname "$0")/../environments/$ENVIRONMENT"

if [ ! -f "tfplan" ]; then
  echo "❌ No plan file found. Run ./plan.sh first"
  exit 1
fi

echo "Applying Terraform changes for $ENVIRONMENT..."
terraform apply tfplan

rm -f tfplan

echo "✅ Infrastructure deployed successfully"
```

---

## Mejores Prácticas

### 1. State Management
- Backend S3 con versionado
- DynamoDB para locks
- Cifrado en reposo

### 2. Seguridad
- Secrets Manager para credenciales
- KMS para cifrado
- Security groups restrictivos
- IAM roles con least privilege

### 3. Módulos
- Reutilizables entre entornos
- Versionados
- Documentados
- Testeados

### 4. Variables
- Sensibles marcadas como `sensitive = true`
- Defaults razonables
- Validaciones donde sea necesario
- Pasadas por variables de entorno en CI/CD

### 5. Tags
- Default tags en provider
- Tags específicos por recurso
- Consistentes entre entornos

### 6. Outputs
- Exponer solo lo necesario
- Útiles para otros módulos
- Sensibles marcados

---

## Próximos Pasos

1. Crear módulos adicionales:
   - ECS/Fargate
   - Lambda
   - API Gateway
   - EventBridge
   - S3
   - CloudFront
   - Monitoring

2. Setup CI/CD con GitHub Actions:
   - Terraform plan en PRs
   - Terraform apply en merge a main
   - Drift detection

3. Testing:
   - Terratest para módulos
   - Policy as Code (OPA/Sentinel)
   - Cost estimation

4. Documentation:
   - Terraform docs generator
   - Architecture diagrams
   - Runbooks
