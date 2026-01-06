# VPC Outputs (Using Default VPC for Free Tier)
output "vpc_id" {
  description = "ID of the VPC"
  value       = data.aws_vpc.default.id
}

output "subnet_ids" {
  description = "List of subnet IDs"
  value       = data.aws_subnets.default.ids
}

# RDS Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
}

output "rds_address" {
  description = "RDS instance address"
  value       = module.rds.db_instance_address
}

output "rds_port" {
  description = "RDS instance port"
  value       = module.rds.db_instance_port
}

output "rds_database_name" {
  description = "Database name"
  value       = module.rds.db_name
}

output "rds_secret_arn" {
  description = "ARN of database credentials secret"
  value       = module.rds.secret_arn
}

output "rds_connection_string" {
  description = "PostgreSQL connection string"
  value       = module.rds.connection_string
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
