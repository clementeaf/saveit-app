variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "saveit"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones for multi-AZ deployment"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "db_engine_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15.5"
}

variable "db_instance_class" {
  description = "RDS instance class (use db.t2.micro for free tier)"
  type        = string
  default     = "db.t2.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "redis_engine_version" {
  description = "Redis version"
  type        = string
  default     = "7.1"
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "container_port" {
  description = "Container port for services"
  type        = number
  default     = 3001
}

variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}

# EC2 Configuration
variable "ec2_instance_type" {
  description = "EC2 instance type (use t2.micro for free tier)"
  type        = string
  default     = "t2.micro"
}

variable "ec2_root_volume_size" {
  description = "EC2 root volume size in GB (30GB free for 12 months)"
  type        = number
  default     = 20
}

variable "ssh_cidr_blocks" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Restrict to your IP in production
}

variable "create_ssh_key_pair" {
  description = "Create a new SSH key pair"
  type        = bool
  default     = false
}

variable "ssh_public_key" {
  description = "SSH public key content (required if create_ssh_key_pair is true)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "existing_ssh_key_name" {
  description = "Name of existing SSH key pair"
  type        = string
  default     = null
}

variable "create_elastic_ip" {
  description = "Create and associate an Elastic IP"
  type        = bool
  default     = false
}

# Application Configuration
variable "redis_endpoint_url" {
  description = "Redis endpoint URL (use Upstash for free tier)"
  type        = string
  default     = ""
}

variable "app_repository_url" {
  description = "Git repository URL for the application"
  type        = string
  default     = ""
}
