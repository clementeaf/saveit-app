aws_region       = "us-east-1"
environment      = "dev"
project_name     = "saveit"
vpc_cidr         = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b"]

# Database
db_instance_class    = "db.t3.micro"
db_allocated_storage = 20
db_engine_version    = "15.3"

# Redis
redis_node_type       = "cache.t3.micro"
redis_engine_version  = "7.1"

# Container
container_port = 3001

# Monitoring
enable_monitoring = true
