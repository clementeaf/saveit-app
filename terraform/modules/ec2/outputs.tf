output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.app.id
}

output "instance_arn" {
  description = "ARN of the EC2 instance"
  value       = aws_instance.app.arn
}

output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.app.public_ip
}

output "instance_private_ip" {
  description = "Private IP address of the EC2 instance"
  value       = aws_instance.app.private_ip
}

output "instance_public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = aws_instance.app.public_dns
}

output "elastic_ip" {
  description = "Elastic IP address (if created)"
  value       = var.create_eip ? aws_eip.app[0].public_ip : null
}

output "security_group_id" {
  description = "ID of the EC2 security group"
  value       = aws_security_group.ec2.id
}

output "iam_role_name" {
  description = "Name of the IAM role"
  value       = aws_iam_role.ec2.name
}

output "iam_role_arn" {
  description = "ARN of the IAM role"
  value       = aws_iam_role.ec2.arn
}

output "instance_profile_name" {
  description = "Name of the IAM instance profile"
  value       = aws_iam_instance_profile.ec2.name
}

output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.app.name
}

output "ssh_connection_string" {
  description = "SSH connection string"
  value       = "ssh -i ~/.ssh/${var.project_name}-${var.environment}.pem ubuntu@${aws_instance.app.public_ip}"
}
