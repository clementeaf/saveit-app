#!/bin/bash
set -e

# User data script for SaveIt App EC2 instance
# This script runs on first boot to set up the environment

echo "=== SaveIt App EC2 Setup Started ==="
echo "Environment: ${environment}"
echo "Project: ${project_name}"

# Update system packages
echo "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install essential packages
echo "Installing essential packages..."
apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    jq \
    ca-certificates \
    gnupg \
    lsb-release \
    apt-transport-https \
    software-properties-common

# Database configuration
if [ "${use_external_database}" = "true" ]; then
    echo "Using external PostgreSQL database (Supabase/Neon/etc.)"
else
    echo "PostgreSQL will be accessed via AWS RDS (managed service)"
    echo "Database credentials will be fetched from AWS Secrets Manager"
fi

# Install Docker
echo "Installing Docker..."
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu

# Install Docker Compose
echo "Installing Docker Compose..."
DOCKER_COMPOSE_VERSION="2.24.0"
curl -L "https://github.com/docker/compose/releases/download/v$${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install AWS CLI
echo "Installing AWS CLI..."
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# Install Node.js 20.x
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2 for process management
echo "Installing PM2..."
npm install -g pm2

# Configure CloudWatch Logs agent
echo "Installing CloudWatch Logs agent..."
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i -E ./amazon-cloudwatch-agent.deb
rm amazon-cloudwatch-agent.deb

# Create application directory
echo "Creating application directory..."
mkdir -p /opt/saveit-app
chown ubuntu:ubuntu /opt/saveit-app

# Environment file will be created by fetch-secrets.sh script
# No template needed as all values come from Secrets Manager or variables

# Create systemd service for the app
echo "Creating systemd service..."
cat > /etc/systemd/system/saveit-app.service << 'EOF'
[Unit]
Description=SaveIt App
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/saveit-app
ExecStartPre=/usr/local/bin/docker-compose pull
ExecStart=/usr/local/bin/docker-compose up
ExecStop=/usr/local/bin/docker-compose down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create helper scripts
echo "Creating helper scripts..."

# Script to fetch secrets from AWS Secrets Manager or use external database
cat > /usr/local/bin/fetch-secrets.sh << 'EOFSCRIPT'
#!/bin/bash
set -e

# Check if using external database
if [ "${use_external_database}" = "true" ]; then
    echo "Using external database configuration..."
    
    # Check if credentials are in Secrets Manager
    if [ -n "${external_database_secret_name}" ]; then
        echo "Fetching external database credentials from Secrets Manager..."
        AWS_REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
        
        SECRET_JSON=$(aws secretsmanager get-secret-value \
            --secret-id "${external_database_secret_name}" \
            --region "$AWS_REGION" \
            --query SecretString \
            --output text 2>&1) || {
            echo "ERROR: Could not fetch secret '${external_database_secret_name}'"
            exit 1
        }
        
        DB_HOST=$(echo "$SECRET_JSON" | jq -r '.host // .DB_HOST // empty')
        DB_PORT=$(echo "$SECRET_JSON" | jq -r '.port // .DB_PORT // empty')
        DB_NAME=$(echo "$SECRET_JSON" | jq -r '.dbname // .DB_NAME // .name // empty')
        DB_USER=$(echo "$SECRET_JSON" | jq -r '.username // .DB_USER // .user // empty')
        DB_PASS=$(echo "$SECRET_JSON" | jq -r '.password // .DB_PASSWORD // empty')
    else
        # Use direct variables (from Terraform)
        DB_HOST="${external_database_host}"
        DB_PORT="${external_database_port}"
        DB_NAME="${external_database_name}"
        DB_USER="${external_database_user}"
        DB_PASS="${external_database_password}"
    fi
    
    # Validate all values are present
    if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASS" ]; then
        echo "ERROR: Missing external database credentials"
        exit 1
    fi
    
    echo "External database configured: $DB_HOST:$DB_PORT/$DB_NAME"
else
    # Use AWS RDS (fetch from Secrets Manager)
    echo "Using AWS RDS database..."
    SECRET_NAME="${project_name}-${environment}-db-credentials"
    
    echo "Fetching database credentials from Secrets Manager..."
    echo "Secret name: $SECRET_NAME"
    
    AWS_REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
    
    # Try to fetch secret by name (more reliable than ARN)
    SECRET_JSON=$(aws secretsmanager get-secret-value \
        --secret-id "$SECRET_NAME" \
        --region "$AWS_REGION" \
        --query SecretString \
        --output text 2>&1) || {
        echo "WARNING: Could not fetch secret '$SECRET_NAME'. Error: $SECRET_JSON"
        echo "This is normal if RDS hasn't been created yet. Run this script again after RDS is ready."
        exit 0
    }
    
    if [ -z "$SECRET_JSON" ] || [ "$SECRET_JSON" = "None" ]; then
        echo "ERROR: Failed to fetch secret from Secrets Manager"
        exit 1
    fi
    
    DB_HOST=$(echo "$SECRET_JSON" | jq -r '.host')
    DB_PORT=$(echo "$SECRET_JSON" | jq -r '.port')
    DB_NAME=$(echo "$SECRET_JSON" | jq -r '.dbname')
    DB_USER=$(echo "$SECRET_JSON" | jq -r '.username')
    DB_PASS=$(echo "$SECRET_JSON" | jq -r '.password')
    
    # Validate all values are present
    if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASS" ]; then
        echo "ERROR: Missing database credentials in secret"
        exit 1
    fi
    
    echo "RDS database configured: $DB_HOST:$DB_PORT/$DB_NAME"
fi

# Create .env file with individual database variables (as expected by config.ts)
{
    echo "NODE_ENV=${environment}"
    echo "PORT=3001"
    echo "DB_HOST=$DB_HOST"
    echo "DB_PORT=$DB_PORT"
    echo "DB_NAME=$DB_NAME"
    echo "DB_USER=$DB_USER"
    echo "DB_PASSWORD=$DB_PASS"
    echo "DB_SSL=true"
    echo "REDIS_URL=${redis_endpoint}"
    echo "LOG_LEVEL=info"
} > /opt/saveit-app/.env

chmod 600 /opt/saveit-app/.env
chown ubuntu:ubuntu /opt/saveit-app/.env

echo "Database credentials configured successfully"
echo "Database host: $DB_HOST:$DB_PORT"
echo "Database name: $DB_NAME"
EOFSCRIPT

chmod +x /usr/local/bin/fetch-secrets.sh
chown ubuntu:ubuntu /usr/local/bin/fetch-secrets.sh

# Script to deploy application
cat > /usr/local/bin/deploy-app.sh << 'EOFSCRIPT'
#!/bin/bash
set -e

cd /opt/saveit-app

echo "Fetching latest code..."
if [ -n "${app_repository_url}" ]; then
    if [ -d ".git" ]; then
        git pull origin main
    else
        git clone "${app_repository_url}" .
    fi
fi

echo "Fetching secrets..."
/usr/local/bin/fetch-secrets.sh

echo "Starting application..."
systemctl restart saveit-app

echo "Deployment complete!"
EOFSCRIPT

chmod +x /usr/local/bin/deploy-app.sh
chown ubuntu:ubuntu /usr/local/bin/deploy-app.sh

# Configure Nginx as reverse proxy
echo "Installing and configuring Nginx..."
apt-get install -y nginx

cat > /etc/nginx/sites-available/saveit-app << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://localhost:3001/health;
        access_log off;
    }
}
EOF

ln -sf /etc/nginx/sites-available/saveit-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl restart nginx
systemctl enable nginx

# Configure firewall
echo "Configuring firewall..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw reload

# Setup log rotation
echo "Configuring log rotation..."
cat > /etc/logrotate.d/saveit-app << 'EOF'
/opt/saveit-app/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 ubuntu ubuntu
}
EOF

# Create logs directory
mkdir -p /opt/saveit-app/logs
chown ubuntu:ubuntu /opt/saveit-app/logs

# Set hostname
echo "${project_name}-${environment}" > /etc/hostname
hostname -F /etc/hostname

# Final message
echo "=== SaveIt App EC2 Setup Completed ==="
echo "Next steps:"
echo "1. SSH into the instance: ssh ubuntu@<instance-ip>"
echo "2. Deploy app: sudo /usr/local/bin/deploy-app.sh"
echo "3. Check status: systemctl status saveit-app"
echo "4. View logs: journalctl -u saveit-app -f"

# Optional: Auto-deploy if repository URL is provided
# Uncomment to enable automatic deployment on boot
if [ -n "${app_repository_url}" ]; then
    echo "Auto-deploying application..."
    sudo -u ubuntu /usr/local/bin/deploy-app.sh
fi
