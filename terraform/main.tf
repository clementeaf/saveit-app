terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Uncomment for remote state management
  # backend "s3" {
  #   bucket         = "saveit-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "saveit-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "SaveIt"
      ManagedBy   = "Terraform"
    }
  }
}

# Get default VPC (Free Tier friendly)
data "aws_vpc" "default" {
  default = true
}

# Get default subnets
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# EC2 Application Server Module (Free Tier: t2.micro)
# Create EC2 first to get security group ID for RDS
module "ec2" {
  source = "./modules/ec2"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = data.aws_vpc.default.id
  subnet_id          = data.aws_subnets.default.ids[0]
  
  # Free Tier configuration
  instance_type      = var.ec2_instance_type
  root_volume_size   = var.ec2_root_volume_size
  
  # Network
  associate_public_ip = true
  ssh_cidr_blocks     = var.ssh_cidr_blocks
  app_port            = var.container_port
  
  # SSH Key
  create_key_pair     = var.create_ssh_key_pair
  ssh_public_key      = var.ssh_public_key
  existing_key_name   = var.existing_ssh_key_name
  
  # Application configuration
  # Note: db_secret_arn will be empty initially, but user-data.sh will fetch it
  # from Secrets Manager using the secret name pattern
  db_secret_arn       = "" # User-data script will construct ARN from secret name
  redis_endpoint      = var.redis_endpoint_url
  app_repository_url  = var.app_repository_url
  
  # Secrets access - Grant access to RDS secret (using pattern matching)
  # The IAM policy will allow access to secrets matching the pattern
  secrets_arns = ["arn:aws:secretsmanager:*:*:secret:${var.project_name}-${var.environment}-db-credentials*"]
  
  # Monitoring
  enable_detailed_monitoring = false # Costs extra
  create_alarms             = var.enable_monitoring
  log_retention_days        = 7
  
  # Static IP (optional)
  create_eip = var.create_elastic_ip
}

# RDS PostgreSQL Module (Free Tier: db.t2.micro)
# Created after EC2 to use EC2 security group
module "rds" {
  source = "./modules/rds"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = data.aws_vpc.default.id
  subnet_ids         = data.aws_subnets.default.ids
  
  # Free Tier configuration
  instance_class      = var.db_instance_class
  allocated_storage   = var.db_allocated_storage
  engine_version      = var.db_engine_version
  
  # Security - Allow access from EC2 security group
  allowed_security_groups = [module.ec2.security_group_id]
  
  # Single-AZ for free tier
  multi_az = false
  
  # Development settings
  deletion_protection = var.environment == "prod" ? true : false
  skip_final_snapshot = var.environment != "prod"
  
  # Monitoring
  monitoring_interval = 0 # Enhanced monitoring costs extra
  create_alarms       = var.enable_monitoring

  depends_on = [module.ec2]
}
