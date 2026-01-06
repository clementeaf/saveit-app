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

# Install PostgreSQL
echo "Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

# Configure PostgreSQL
echo "Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE saveit_db;"
sudo -u postgres psql -c "CREATE USER saveit_admin WITH PASSWORD 'saveit_dev_2026';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE saveit_db TO saveit_admin;"
sudo -u postgres psql -c "ALTER DATABASE saveit_db OWNER TO saveit_admin;"

# Allow local connections
PG_VERSION=$(ls /etc/postgresql/)
echo "host    all             all             127.0.0.1/32            md5" | sudo tee -a /etc/postgresql/$PG_VERSION/main/pg_hba.conf
echo "host    all             all             ::1/128                 md5" | sudo tee -a /etc/postgresql/$PG_VERSION/main/pg_hba.conf

sudo systemctl restart postgresql
echo "PostgreSQL configured successfully!"

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

# Create environment file template
echo "Creating environment file template..."
cat > /opt/saveit-app/.env.template << 'EOF'
NODE_ENV=${environment}
PORT=3001

# Database (to be populated from Secrets Manager)
DATABASE_URL=

# Redis
REDIS_URL=${redis_endpoint}

# Application
LOG_LEVEL=info
EOF

chown ubuntu:ubuntu /opt/saveit-app/.env.template

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

# Script to fetch secrets from AWS Secrets Manager
cat > /usr/local/bin/fetch-secrets.sh << 'EOFSCRIPT'
#!/bin/bash
# Fetch database credentials from Secrets Manager
if [ -n "${db_secret_arn}" ]; then
    echo "Fetching database credentials..."
    SECRET_JSON=$(aws secretsmanager get-secret-value \
        --secret-id "${db_secret_arn}" \
        --region $(curl -s http://169.254.169.254/latest/meta-data/placement/region) \
        --query SecretString \
        --output text)
    
    DB_HOST=$(echo $SECRET_JSON | jq -r '.host')
    DB_PORT=$(echo $SECRET_JSON | jq -r '.port')
    DB_NAME=$(echo $SECRET_JSON | jq -r '.dbname')
    DB_USER=$(echo $SECRET_JSON | jq -r '.username')
    DB_PASS=$(echo $SECRET_JSON | jq -r '.password')
    
    # Update .env file
    echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME" > /opt/saveit-app/.env
    cat /opt/saveit-app/.env.template >> /opt/saveit-app/.env
    
    echo "Database credentials fetched successfully"
fi
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
# if [ -n "${app_repository_url}" ]; then
#     echo "Auto-deploying application..."
#     sudo -u ubuntu /usr/local/bin/deploy-app.sh
# fi
