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

variable "subnet_ids" {
  description = "List of subnet IDs for RDS subnet group"
  type        = list(string)
}

variable "allowed_security_groups" {
  description = "List of security group IDs allowed to access RDS"
  type        = list(string)
  default     = []
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.5"
}

variable "instance_class" {
  description = "RDS instance class (use db.t2.micro for free tier)"
  type        = string
  default     = "db.t2.micro"
}

variable "allocated_storage" {
  description = "Allocated storage in GB (20GB free for 12 months)"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Maximum allocated storage for autoscaling"
  type        = number
  default     = 100
}

variable "storage_encrypted" {
  description = "Enable storage encryption"
  type        = bool
  default     = true
}

variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "saveit_db"
}

variable "db_username" {
  description = "Master username for the database"
  type        = string
  default     = "saveit_admin"
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment (NOT recommended for free tier)"
  type        = bool
  default     = false
}

variable "backup_retention_period" {
  description = "Number of days to retain backups (7 days recommended)"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Preferred backup window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window (UTC)"
  type        = string
  default     = "Mon:04:00-Mon:05:00"
}

variable "enabled_cloudwatch_logs_exports" {
  description = "List of log types to export to CloudWatch"
  type        = list(string)
  default     = ["postgresql", "upgrade"]
}

variable "monitoring_interval" {
  description = "Enhanced monitoring interval in seconds (0 to disable, 60 recommended)"
  type        = number
  default     = 0
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights (costs extra)"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot when destroying (true for dev, false for prod)"
  type        = bool
  default     = true
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
