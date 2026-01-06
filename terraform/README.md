# SaveIt App - Terraform Infrastructure

Infrastructure as Code for SaveIt App using Terraform on AWS.

## Prerequisites

- Terraform >= 1.5
- AWS CLI configured with credentials
- AWS Account with appropriate permissions

## Structure

```
terraform/
├── main.tf              # Provider configuration
├── variables.tf         # Root module variables
├── outputs.tf          # Root module outputs
├── vpc.tf              # VPC module
├── modules/
│   └── vpc/            # VPC networking module
├── environments/
│   ├── dev.tfvars      # Development environment
│   └── prod.tfvars     # Production environment
└── README.md           # This file
```

## Usage

### Initialize Terraform

```bash
cd terraform
terraform init
```

### Plan Deployment (Dev)

```bash
terraform plan -var-file="environments/dev.tfvars" -out=tfplan.dev
```

### Apply Deployment (Dev)

```bash
terraform apply tfplan.dev
```

### Plan Deployment (Prod)

```bash
terraform plan -var-file="environments/prod.tfvars" -out=tfplan.prod
```

### Apply Deployment (Prod)

```bash
terraform apply tfplan.prod
```

### Destroy Infrastructure

```bash
# Dev
terraform destroy -var-file="environments/dev.tfvars"

# Prod
terraform destroy -var-file="environments/prod.tfvars"
```

## Modules

### VPC Module

Creates:
- VPC with CIDR block
- Public and Private subnets across multiple AZs
- Internet Gateway
- NAT Gateways for private subnets
- Route tables
- Security Groups (ALB, ECS, RDS, Redis)

**Location**: `modules/vpc/main.tf`

### Future Modules

- RDS (PostgreSQL Multi-AZ)
- ElastiCache (Redis)
- ECS (Fargate)
- ALB (Application Load Balancer)

## State Management

For production, enable remote state:

1. Create S3 bucket for state
2. Create DynamoDB table for locking
3. Uncomment backend configuration in `main.tf`

```hcl
backend "s3" {
  bucket         = "saveit-terraform-state"
  key            = "prod/terraform.tfstate"
  region         = "us-east-1"
  encrypt        = true
  dynamodb_table = "saveit-terraform-locks"
}
```

## Outputs

After applying, Terraform outputs:
- VPC ID
- Public Subnet IDs
- Private Subnet IDs
- Security Group IDs

## Cost Estimation

For cost estimation before deployment:

```bash
terraform plan -var-file="environments/dev.tfvars" | grep -E "will be|destroyed"
```

## Troubleshooting

### Import Existing Resources

If resources already exist in AWS:

```bash
terraform import module.vpc.aws_vpc.main vpc-xxxxx
```

### Validate Configuration

```bash
terraform validate
terraform fmt -check
```

## Best Practices

- Always plan before apply
- Use remote state for team collaboration
- Tag all resources properly
- Use separate workspaces for environments
- Review diffs carefully before applying

## References

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [SaveIt App Architecture](../docs/ARQUITECTURA.md)
