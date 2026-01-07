# VPC Outputs (Using Default VPC for Free Tier)
output "vpc_id" {
  description = "ID of the VPC"
  value       = data.aws_vpc.default.id
}

output "subnet_ids" {
  description = "List of subnet IDs"
  value       = data.aws_subnets.default.ids
}

# RDS Outputs (only when using AWS RDS)
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = var.use_external_database ? null : (length(module.rds) > 0 ? module.rds[0].db_instance_endpoint : null)
}

output "rds_address" {
  description = "RDS instance address"
  value       = var.use_external_database ? null : (length(module.rds) > 0 ? module.rds[0].db_instance_address : null)
}

output "rds_port" {
  description = "RDS instance port"
  value       = var.use_external_database ? null : (length(module.rds) > 0 ? module.rds[0].db_instance_port : null)
}

output "rds_database_name" {
  description = "Database name"
  value       = var.use_external_database ? null : (length(module.rds) > 0 ? module.rds[0].db_name : null)
}

output "rds_secret_arn" {
  description = "ARN of database credentials secret"
  value       = var.use_external_database ? null : (length(module.rds) > 0 ? module.rds[0].secret_arn : null)
}

output "rds_connection_string" {
  description = "PostgreSQL connection string"
  value       = var.use_external_database ? null : (length(module.rds) > 0 ? module.rds[0].connection_string : null)
  sensitive   = true
}

# External Database Info (when using external database)
output "external_database_info" {
  description = "External database configuration (host only, for security)"
  value       = var.use_external_database ? "Using external database: ${var.external_database_host}:${var.external_database_port}/${var.external_database_name}" : null
  sensitive   = true
}


# EC2 Outputs
output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = module.ec2.instance_id
}

output "ec2_public_ip" {
  description = "EC2 public IP address"
  value       = module.ec2.instance_public_ip
}

output "ec2_public_dns" {
  description = "EC2 public DNS name"
  value       = module.ec2.instance_public_dns
}

output "ec2_elastic_ip" {
  description = "Elastic IP address (if created)"
  value       = module.ec2.elastic_ip
}

output "ec2_ssh_connection" {
  description = "SSH connection string"
  value       = module.ec2.ssh_connection_string
}

# Application URLs
output "app_url" {
  description = "Application URL"
  value       = "http://${module.ec2.instance_public_ip}"
}

output "app_health_check" {
  description = "Health check URL"
  value       = "http://${module.ec2.instance_public_ip}/health"
}
