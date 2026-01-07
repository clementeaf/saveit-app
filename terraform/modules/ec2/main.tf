# EC2 Instance Module for AWS Free Tier
# Uses t2.micro (750 hours/month free for 12 months)

# Get latest Ubuntu 22.04 LTS AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Security Group for EC2
resource "aws_security_group" "ec2" {
  name        = "${var.project_name}-${var.environment}-ec2-sg"
  description = "Security group for EC2 application server"
  vpc_id      = var.vpc_id

  # HTTP
  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH (restrict to your IP in production)
  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_cidr_blocks
  }

  # Application port (if needed)
  dynamic "ingress" {
    for_each = var.app_port != null ? [1] : []
    content {
      description = "Application port"
      from_port   = var.app_port
      to_port     = var.app_port
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  # Egress - allow all outbound
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-ec2-sg"
    Environment = var.environment
  }
}

# Key Pair for SSH access
resource "aws_key_pair" "deployer" {
  count      = var.create_key_pair ? 1 : 0
  key_name   = "${var.project_name}-${var.environment}-key"
  public_key = var.ssh_public_key

  tags = {
    Name        = "${var.project_name}-${var.environment}-key"
    Environment = var.environment
  }
}

# IAM Role for EC2 instance
resource "aws_iam_role" "ec2" {
  name = "${var.project_name}-${var.environment}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-ec2-role"
    Environment = var.environment
  }
}

# IAM Policy for EC2 to access Secrets Manager
resource "aws_iam_role_policy" "secrets_access" {
  name = "${var.project_name}-${var.environment}-secrets-access"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = length(var.secrets_arns) > 0 ? var.secrets_arns : [
          "arn:aws:secretsmanager:*:*:secret:${var.project_name}-${var.environment}-*"
        ]
      }
    ]
  })
}

# IAM Policy for CloudWatch Logs
resource "aws_iam_role_policy_attachment" "cloudwatch_logs" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# IAM Policy for SSM (Systems Manager) for easier management
resource "aws_iam_role_policy_attachment" "ssm_managed" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-${var.environment}-ec2-profile"
  role = aws_iam_role.ec2.name

  tags = {
    Name        = "${var.project_name}-${var.environment}-ec2-profile"
    Environment = var.environment
  }
}

# User data script for initial setup
locals {
  user_data = templatefile("${path.module}/user-data.sh", {
    environment                  = var.environment
    project_name                 = var.project_name
    db_secret_arn                = var.db_secret_arn
    redis_endpoint               = var.redis_endpoint
    app_repository_url           = var.app_repository_url
    use_external_database        = var.use_external_database ? "true" : "false"
    external_database_host       = var.external_database_host
    external_database_port       = var.external_database_port
    external_database_name       = var.external_database_name
    external_database_user       = var.external_database_user
    external_database_password   = var.external_database_password
    external_database_secret_name = var.external_database_secret_name
  })
}

# EC2 Instance (Free Tier Eligible)
resource "aws_instance" "app" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type # t2.micro for free tier

  # Network
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  associate_public_ip_address = var.associate_public_ip

  # SSH Key
  key_name = var.create_key_pair ? aws_key_pair.deployer[0].key_name : var.existing_key_name

  # IAM
  iam_instance_profile = aws_iam_instance_profile.ec2.name

  # Storage (30GB free for 12 months)
  root_block_device {
    volume_type           = "gp2"
    volume_size           = var.root_volume_size
    delete_on_termination = true
    encrypted             = true

    tags = {
      Name        = "${var.project_name}-${var.environment}-root-volume"
      Environment = var.environment
    }
  }

  # User data for initialization
  user_data                   = var.enable_user_data ? local.user_data : null
  user_data_replace_on_change = var.user_data_replace_on_change

  # Monitoring (basic is free, detailed costs extra)
  monitoring = var.enable_detailed_monitoring

  # Metadata options (IMDSv2)
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  # Credit specification for T2 instances
  credit_specification {
    cpu_credits = "standard" # or "unlimited" (costs extra)
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-app-server"
    Environment = var.environment
    FreeTier    = var.instance_type == "t2.micro" ? "true" : "false"
    Role        = "application-server"
  }

  lifecycle {
    ignore_changes = [
      ami, # Don't recreate instance on AMI updates
      user_data
    ]
  }
}

# Elastic IP (optional, for static IP)
resource "aws_eip" "app" {
  count    = var.create_eip ? 1 : 0
  domain   = "vpc"
  instance = aws_instance.app.id

  tags = {
    Name        = "${var.project_name}-${var.environment}-eip"
    Environment = var.environment
  }

  depends_on = [aws_instance.app]
}

# CloudWatch Log Group for application logs
resource "aws_cloudwatch_log_group" "app" {
  name              = "/aws/ec2/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-${var.environment}-logs"
    Environment = var.environment
  }
}

# CloudWatch Alarm for CPU utilization
resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-ec2-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors EC2 CPU utilization"
  alarm_actions       = var.alarm_actions

  dimensions = {
    InstanceId = aws_instance.app.id
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-cpu-alarm"
    Environment = var.environment
  }
}

# CloudWatch Alarm for status check failures
resource "aws_cloudwatch_metric_alarm" "status_check" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-ec2-status-check"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = "60"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "This metric monitors EC2 status check failures"
  alarm_actions       = var.alarm_actions

  dimensions = {
    InstanceId = aws_instance.app.id
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-status-alarm"
    Environment = var.environment
  }
}
