# SaveIt App - AWS Free Tier Deployment Guide

Complete guide for deploying SaveIt App on AWS Free Tier ($0-5/month).

## 🆓 Free Tier Coverage (12 months)

| Service | Free Tier | Usage |
|---------|-----------|-------|
| **EC2** | t2.micro - 750 hours/month | Application server |
| **RDS** | db.t2.micro - 750 hours/month + 20GB | PostgreSQL database |
| **EBS** | 30GB SSD storage | EC2 + RDS volumes |
| **S3** | 5GB + 20K GET + 2K PUT/month | File storage |
| **Data Transfer** | 15GB/month outbound | Network egress |
| **CloudWatch** | 10 metrics + 10 alarms | Monitoring |

**Estimated Monthly Cost**: $0-5 (mainly data transfer overages)

## 📋 Prerequisites

1. **AWS Account** (must be <12 months old for free tier)
2. **Terraform** >= 1.5
   ```bash
   brew install terraform  # macOS
   # or download from terraform.io
   ```
3. **AWS CLI** configured
   ```bash
   aws configure
   ```
4. **SSH Key** (optional, Terraform can create one)

## 🚀 Quick Start (5 Steps)

### Step 1: Configure AWS Credentials

```bash
aws configure
# AWS Access Key ID: YOUR_KEY
# AWS Secret Access Key: YOUR_SECRET
# Default region: us-east-1
# Default output format: json
```

### Step 2: Update Configuration

Edit `environments/dev.tfvars`:

```hcl
# CRITICAL: Change this to your IP for security
ssh_cidr_blocks = ["YOUR.PUBLIC.IP/32"]  # Get your IP: curl ifconfig.me

# Optional: Use existing SSH key
existing_ssh_key_name = "my-aws-key"

# Optional: External Redis (Upstash free tier)
redis_endpoint_url = "https://your-redis.upstash.io"

# Optional: Git repo for auto-deployment
app_repository_url = "https://github.com/your-org/saveit-app.git"
```

### Step 3: Initialize Terraform

```bash
cd terraform
terraform init
```

### Step 4: Preview Changes

```bash
terraform plan -var-file=environments/dev.tfvars
```

Review the output. You should see:
- 1 RDS instance (db.t2.micro)
- 1 EC2 instance (t2.micro)
- 2 security groups
- 1 Secrets Manager secret
- CloudWatch log groups and alarms

### Step 5: Deploy

```bash
terraform apply -var-file=environments/dev.tfvars
```

Type `yes` when prompted. Deployment takes ~10-15 minutes.

## 📤 Get Access Information

After deployment completes:

```bash
# View all outputs
terraform output

# Get specific information
terraform output ec2_public_ip          # EC2 IP address
terraform output ec2_ssh_connection     # SSH command
terraform output rds_endpoint           # Database endpoint
terraform output app_url                # Application URL

# Get database password (sensitive)
terraform output -raw rds_connection_string
```

## 🖥️ Access Your Server

### SSH into EC2

```bash
# Get SSH command
terraform output -raw ec2_ssh_connection

# Example output:
ssh -i ~/.ssh/saveit-dev.pem ubuntu@54.123.45.67
```

### Deploy Your Application

Once connected via SSH:

```bash
# Option 1: Auto-deploy script
sudo /usr/local/bin/deploy-app.sh

# Option 2: Manual deployment
cd /opt/saveit-app
git clone https://github.com/your-org/saveit-app.git .

# Fetch database credentials from AWS Secrets Manager
sudo /usr/local/bin/fetch-secrets.sh

# Start application with Docker Compose
docker-compose up -d

# Check status
docker ps
systemctl status saveit-app
```

### Test Application

```bash
# Get health check URL
terraform output app_health_check

# Test from your machine
curl http://$(terraform output -raw ec2_public_ip)/health
```

## 🛠️ What's Pre-installed on EC2

The EC2 instance comes with everything ready:

- ✅ Docker + Docker Compose
- ✅ Node.js 20.x + npm
- ✅ PM2 (process manager)
- ✅ Nginx (reverse proxy configured)
- ✅ AWS CLI
- ✅ CloudWatch Logs agent
- ✅ Helper scripts for deployment

## 💰 Cost Management

### Set Up Billing Alerts

**CRITICAL**: Do this immediately after deployment!

```bash
# In AWS Console:
# 1. Go to CloudWatch → Billing → Create Alarm
# 2. Set threshold: $5
# 3. Add your email for notifications
```

### Monitor Free Tier Usage

```bash
# Check current free tier usage
open https://console.aws.amazon.com/billing/home#/freetier
```

### Stop Resources When Not Using

```bash
# Stop EC2 to save free tier hours
aws ec2 stop-instances --instance-ids $(terraform output -raw ec2_instance_id)

# Start when needed
aws ec2 start-instances --instance-ids $(terraform output -raw ec2_instance_id)

# Note: You can't stop RDS for >7 days (it auto-restarts)
```

### Services to AVOID (They cost money)

- ❌ NAT Gateway (~$32/month)
- ❌ Application Load Balancer (~$16/month)
- ❌ ElastiCache Redis (~$13/month) → Use Upstash instead
- ❌ Multi-AZ RDS (doubles RDS cost)
- ❌ Elastic IP when not attached ($0.005/hour)
- ❌ Detailed CloudWatch monitoring

## 🔍 Using External Redis (Upstash)

To avoid ElastiCache costs, use Upstash free tier:

### 1. Sign Up for Upstash

Visit: https://upstash.com

### 2. Create Redis Database

- Choose free tier (10,000 commands/day)
- Select region closest to `us-east-1`
- Copy the REST URL

### 3. Update Configuration

```hcl
# In environments/dev.tfvars
# Formato: redis://default:PASSWORD@ENDPOINT.upstash.io:6379
redis_endpoint_url = "redis://default:TU_PASSWORD@redis-12345.upstash.io:6379"
```

**Nota:** Upstash proporciona dos tipos de endpoints:
- **REST API** (https://) - Para HTTP requests
- **Redis Endpoint** (redis://) - Para conexiones Redis nativas

**Usa el Redis Endpoint** (redis://) para la aplicación Node.js.

### 4. Configure Application

Your app will automatically use this Redis URL via environment variable.

## 🔐 SSH Key Management

### Option 1: Use Existing AWS Key

```hcl
# In environments/dev.tfvars
existing_ssh_key_name = "my-existing-aws-key"
create_ssh_key_pair = false
```

### Option 2: Create New Key with Terraform

```bash
# 1. Generate SSH key locally
ssh-keygen -t rsa -b 4096 -f ~/.ssh/saveit-dev -N ""

# 2. Copy public key content
cat ~/.ssh/saveit-dev.pub

# 3. Update environments/dev.tfvars
create_ssh_key_pair = true
ssh_public_key = "ssh-rsa AAAAB3NzaC1yc2EA... your-email@example.com"
```

## 📊 Monitoring

### View Application Logs

```bash
# Option 1: CloudWatch Logs (from your machine)
aws logs tail /aws/ec2/saveit-dev --follow

# Option 2: SSH into server
ssh ubuntu@<ec2-ip>
journalctl -u saveit-app -f
docker-compose logs -f
```

### CloudWatch Alarms

Alarms are automatically created for:
- EC2 CPU > 80%
- EC2 status check failures
- RDS CPU > 80%
- RDS memory < 100MB
- RDS storage < 2GB

View alarms: https://console.aws.amazon.com/cloudwatch/

## 🗄️ Database Operations

### Connect to Database

```bash
# SSH into EC2 first
ssh ubuntu@<ec2-ip>

# Get connection string
aws secretsmanager get-secret-value --secret-id saveit-dev-db-credentials --query SecretString --output text

# Connect with psql
psql "postgresql://user:pass@rds-endpoint:5432/saveit_db"
```

### Run Migrations

```bash
cd /opt/saveit-app
npm run db:migrate
npm run db:seed
```

### Backup Database

```bash
# Automated backups are configured for 7 days
# To create manual snapshot:
aws rds create-db-snapshot \
  --db-instance-identifier saveit-dev-db \
  --db-snapshot-identifier saveit-dev-manual-backup-$(date +%Y%m%d)
```

## 🐛 Troubleshooting

### Can't SSH into EC2

```bash
# Check instance is running
aws ec2 describe-instances --instance-ids $(terraform output -raw ec2_instance_id)

# Check security group allows your IP
aws ec2 describe-security-groups --group-ids <sg-id>

# Verify SSH key permissions
chmod 400 ~/.ssh/your-key.pem
```

### Application Not Responding

```bash
# SSH into server
ssh ubuntu@<ec2-ip>

# Check application status
systemctl status saveit-app
docker ps

# View logs
journalctl -u saveit-app -xe
docker-compose logs

# Restart application
sudo systemctl restart saveit-app
```

### Can't Connect to Database

```bash
# From EC2 instance, test connection
psql "$(terraform output -raw rds_connection_string)"

# Check RDS security group allows EC2
aws rds describe-db-instances --db-instance-identifier saveit-dev-db
```

### Terraform Errors

```bash
# Validate syntax
terraform validate

# Format code
terraform fmt

# Refresh state
terraform refresh -var-file=environments/dev.tfvars

# Force unlock (if locked)
terraform force-unlock <lock-id>
```

## 🗑️ Cleanup / Destroy

### Destroy Everything

```bash
terraform destroy -var-file=environments/dev.tfvars
```

Type `yes` when prompted. Takes ~10 minutes.

### Destroy Specific Resource

```bash
# Example: Destroy only EC2
terraform destroy -target=module.ec2 -var-file=environments/dev.tfvars
```

### Manual Cleanup

If Terraform fails to destroy:

```bash
# Terminate EC2
aws ec2 terminate-instances --instance-ids <instance-id>

# Delete RDS (without final snapshot)
aws rds delete-db-instance --db-instance-identifier saveit-dev-db --skip-final-snapshot

# Delete security groups
aws ec2 delete-security-group --group-id <sg-id>
```

## 📈 Scaling Beyond Free Tier

When you're ready to grow:

### 1. Upgrade to Paid Tier

```hcl
# In environments/prod.tfvars
db_instance_class = "db.t3.small"      # ~$25/month
ec2_instance_type = "t3.small"         # ~$15/month
create_elastic_ip = true               # Static IP
```

### 2. Enable Multi-AZ for High Availability

```hcl
# In terraform/main.tf module "rds"
multi_az = true  # Doubles RDS cost
```

### 3. Add Load Balancer

Uncomment ECS/ALB module in `main.tf`

### 4. Add ElastiCache

Switch from Upstash to AWS ElastiCache

## ⚠️ Important Notes

- ✅ Free tier is **12 months** from AWS account creation
- ✅ Monitor billing dashboard weekly
- ✅ Set billing alarms immediately
- ✅ Stop resources when not in use
- ✅ Keep SSH keys secure (never commit to git)
- ✅ Restrict SSH access to your IP only
- ✅ Use strong passwords (Terraform generates 16-char random)
- ⚠️ Data transfer can exceed free tier if heavy traffic
- ⚠️ RDS storage auto-grows (monitor size)
- ⚠️ Stopped EC2 still incurs EBS charges (minimal)

## 📚 Additional Resources

- [AWS Free Tier Details](https://aws.amazon.com/free/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Upstash Redis](https://upstash.com)
- [AWS Billing Dashboard](https://console.aws.amazon.com/billing/)

## 🆘 Getting Help

If stuck:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review CloudWatch Logs
3. Verify free tier limits not exceeded
4. Check AWS Service Health Dashboard
5. Review Terraform plan output

## ✅ Post-Deployment Checklist

After successful deployment:

- [ ] Set up billing alerts ($5 threshold)
- [ ] Verify application health endpoint responds
- [ ] Test SSH access to EC2
- [ ] Confirm database connection works
- [ ] Check CloudWatch Logs are streaming
- [ ] Restrict SSH to your IP only
- [ ] Bookmark AWS billing dashboard
- [ ] Save database credentials securely
- [ ] Test application functionality
- [ ] Set calendar reminder to monitor costs weekly

---

**Cost Summary**: With careful management, you can run SaveIt App for **$0-5/month** for the first 12 months! 🎉
