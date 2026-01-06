variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID where EC2 instance will be launched"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type (use t2.micro for free tier)"
  type        = string
  default     = "t2.micro"
}

variable "root_volume_size" {
  description = "Size of root volume in GB (30GB free for 12 months)"
  type        = number
  default     = 20
}

variable "associate_public_ip" {
  description = "Associate a public IP address"
  type        = bool
  default     = true
}

variable "ssh_cidr_blocks" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Restrict to your IP in production
}

variable "app_port" {
  description = "Application port to expose (optional)"
  type        = number
  default     = null
}

variable "create_key_pair" {
  description = "Create a new SSH key pair"
  type        = bool
  default     = false
}

variable "ssh_public_key" {
  description = "SSH public key content (required if create_key_pair is true)"
  type        = string
  default     = ""
}

variable "existing_key_name" {
  description = "Name of existing key pair (used if create_key_pair is false)"
  type        = string
  default     = null
}

variable "secrets_arns" {
  description = "List of Secrets Manager ARNs that EC2 should have access to"
  type        = list(string)
  default     = ["*"]
}

variable "db_secret_arn" {
  description = "ARN of database credentials secret"
  type        = string
  default     = ""
}

variable "redis_endpoint" {
  description = "Redis endpoint URL"
  type        = string
  default     = ""
}

variable "app_repository_url" {
  description = "Git repository URL for the application"
  type        = string
  default     = ""
}

variable "enable_user_data" {
  description = "Enable user data script for initial setup"
  type        = bool
  default     = true
}

variable "user_data_replace_on_change" {
  description = "Replace instance when user data changes"
  type        = bool
  default     = false
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed monitoring (costs extra)"
  type        = bool
  default     = false
}

variable "create_eip" {
  description = "Create and associate an Elastic IP"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention in days"
  type        = number
  default     = 7
}

variable "create_alarms" {
  description = "Create CloudWatch alarms for monitoring"
  type        = bool
  default     = true
}

variable "alarm_actions" {
  description = "List of ARNs to notify when alarms trigger (SNS topics)"
  type        = list(string)
  default     = []
}
