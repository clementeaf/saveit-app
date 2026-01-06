#!/bin/bash
set -e

# Script to setup Terraform remote backend (S3 + DynamoDB)
# This must be run BEFORE initializing Terraform with remote backend

PROJECT_NAME="${1:-saveit}"
ENVIRONMENT="${2:-dev}"
REGION="${3:-us-east-1}"

echo "Setting up Terraform remote backend for ${PROJECT_NAME}-${ENVIRONMENT}"
echo "Region: ${REGION}"

# S3 Bucket for Terraform state
BUCKET_NAME="${PROJECT_NAME}-terraform-state-${ENVIRONMENT}"
echo "Creating S3 bucket: ${BUCKET_NAME}"

# Create S3 bucket if it doesn't exist
if aws s3 ls "s3://${BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
    echo "Creating S3 bucket..."
    aws s3api create-bucket \
        --bucket "${BUCKET_NAME}" \
        --region "${REGION}" \
        --create-bucket-configuration LocationConstraint="${REGION}" 2>/dev/null || \
    aws s3api create-bucket \
        --bucket "${BUCKET_NAME}" \
        --region "${REGION}" 2>/dev/null
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "${BUCKET_NAME}" \
        --versioning-configuration Status=Enabled
    
    # Enable encryption
    aws s3api put-bucket-encryption \
        --bucket "${BUCKET_NAME}" \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }]
        }'
    
    # Block public access
    aws s3api put-public-access-block \
        --bucket "${BUCKET_NAME}" \
        --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    
    echo "✅ S3 bucket created and configured"
else
    echo "✅ S3 bucket already exists"
fi

# DynamoDB Table for state locking
TABLE_NAME="${PROJECT_NAME}-terraform-locks"
echo "Creating DynamoDB table: ${TABLE_NAME}"

# Check if table exists
if ! aws dynamodb describe-table --table-name "${TABLE_NAME}" --region "${REGION}" 2>/dev/null; then
    echo "Creating DynamoDB table..."
    aws dynamodb create-table \
        --table-name "${TABLE_NAME}" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "${REGION}" \
        --tags Key=Project,Value="${PROJECT_NAME}" Key=Environment,Value="${ENVIRONMENT}" Key=ManagedBy,Value=Terraform
    
    echo "Waiting for table to be active..."
    aws dynamodb wait table-exists --table-name "${TABLE_NAME}" --region "${REGION}"
    
    echo "✅ DynamoDB table created"
else
    echo "✅ DynamoDB table already exists"
fi

echo ""
echo "✅ Backend setup complete!"
echo ""
echo "Next steps:"
echo "1. Update terraform/main.tf to uncomment backend configuration:"
echo "   backend \"s3\" {"
echo "     bucket         = \"${BUCKET_NAME}\""
echo "     key            = \"${ENVIRONMENT}/terraform.tfstate\""
echo "     region         = \"${REGION}\""
echo "     encrypt        = true"
echo "     dynamodb_table = \"${TABLE_NAME}\""
echo "   }"
echo ""
echo "2. Run: terraform init -migrate-state"
echo ""

