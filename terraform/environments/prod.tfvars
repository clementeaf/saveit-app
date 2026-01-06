aws_region       = "us-east-1"
environment      = "prod"
project_name     = "saveit"
vpc_cidr         = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

# Database (Multi-AZ)
db_instance_class    = "db.t3.small"
db_allocated_storage = 100
db_engine_version    = "15.3"

# Redis (Cluster mode)
redis_node_type       = "cache.t3.small"
redis_engine_version  = "7.1"

# Container
container_port = 3001

# Monitoring
enable_monitoring = true
