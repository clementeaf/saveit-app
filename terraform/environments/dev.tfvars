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
# Sign up at: https://upstash.com
redis_endpoint_url = "" # Example: "https://your-redis.upstash.io"

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
