#!/usr/bin/env bash

ROOT_PATH=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/../..

VARIABLES_FILE="$ROOT_PATH/infra/terraform/environments/dev/variables.tfvars"
BACKEND_FILE="$ROOT_PATH/infra/terraform/environments/dev/backend.tfvars"
ENV_FILE="$ROOT_PATH/.env.$ENVIRONMENT"

source "$ROOT_PATH/scripts/utils.sh"

check_preconditions
set_environment "$1"

# ======================================================================
# STEP 1: Preconditions for deploying with Terraform
# ======================================================================
# We'll define some unique names for resources like our
# terraform state bucket or the bucket to which we deploy
# the frontend to avoid conflicts with other projects.
# We'll also pin the AWS account id and ask for a Discord
# webhook URL for alerting.

# check if env variables file exists
# if not, we'll create one and add the random project suffix
if ! [[ -f "$VARIABLES_FILE" ]]; then
    # generate a random suffix with 8 alphanumeric characters
    suffix=$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 8)
    print_success "Generated project suffix: $suffix"
    # Write the project suffix to the variables.tfvars file
    echo "project_suffix = \"$suffix\"" >"$VARIABLES_FILE"
    print_success "variables.tfvars file created with project suffix."
else
    print_success "variables.tfvars file already exists."
fi

# let's check if an account id is already provided
# if not, we'll check the current AWS session and extract
# it from there. We also ask the user if they want to
# use this account id.
if ! grep -q 'aws_account_id' "$VARIABLES_FILE"; then
    aws_account_id=$(aws sts get-caller-identity --query Account --output text)
    # check if we're even logged in
    if [[ -z "$aws_account_id" ]]; then
        print_error "You are not logged into your AWS account."
        exit 1
    fi
    read -p "Use AWS account id $aws_account_id? (y/n): " use_aws_account_id
    if [[ "$use_aws_account_id" == "y" ]]; then
        echo "aws_account_id = \"$aws_account_id\"" >>"$VARIABLES_FILE"
        print_success "AWS account id added to variables.tfvars."
    else
        print_error "Please log into the correct AWS account and retry this."
        exit 1
    fi
else
    print_success "AWS account id already provided."
fi

AWS_ACCOUNT_ID=$(grep 'aws_account_id' "$VARIABLES_FILE" | cut -d '"' -f 2)
check_account_id "$AWS_ACCOUNT_ID"

# Ask the user for a Discord Webhook URL for alerting
# This is optional and can be left empty
if ! grep -q 'discord_webhook_url' "$VARIABLES_FILE"; then
    read -p "Enter Discord Webhook URL for alerting (leave empty to skip): " discord_webhook_url
    if [[ -n "$discord_webhook_url" ]]; then
        echo "discord_webhook_url = \"$discord_webhook_url\"" >>"$VARIABLES_FILE"
        print_success "Discord Webhook URL added to variables.tfvars."
    else
        echo "discord_webhook_url = \"\"" >>"$VARIABLES_FILE"
        print_success "Discord Webhook URL skipped. Please remove the line from variables.tfvars if needed later"
    fi
else
    print_success "Discord Webhook URL already provided or skipped."
fi

# Extract the project_suffix from variables.tfvars
project_suffix=$(grep 'project_suffix' "$VARIABLES_FILE" | cut -d '"' -f 2)

bucket_name="cw-ho-tf-state-${project_suffix}"

# Check if the S3 bucket already exists
if aws s3 ls "s3://$bucket_name" &>/dev/null; then
    print_success "The S3 bucket $bucket_name already exists."
else
    # Create the S3 bucket
    if aws s3 mb "s3://$bucket_name" --region us-east-1 &>/dev/null; then
        print_success "S3 bucket $bucket_name created successfully."
    else
        print_error "Failed to create S3 bucket $bucket_name."
        exit 1
    fi
fi

# Write the backend configuration to the backend.tfvars file
echo "bucket = \"$bucket_name\"" >"$BACKEND_FILE"
print_success "backend.tfvars file created with bucket name."

# DynamoDB lock table creation remains unchanged
# Check if the DynamoDB lock table exists
if ! aws dynamodb describe-table --table-name terraform-state-lock --region us-east-1 &>/dev/null; then
    # Create the DynamoDB lock table
    aws dynamodb create-table \
        --table-name terraform-state-lock \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
        --region us-east-1 &>/dev/null

    if [[ $? -eq 0 ]]; then
        print_success "DynamoDB lock table created successfully."
    else
        print_error "Failed to create DynamoDB lock table."
        exit 1
    fi
else
    print_success "DynamoDB lock table already exists."
fi

# check if alerting email addreses are already provided;
# if not, ask the user to provide them (optionally)
if ! grep -q 'alerting_emails' "$VARIABLES_FILE"; then
    read -p "Enter email addresses for alerting (comma separated - leave empty to skip): " alerting_emails
    if [[ -n "$alerting_emails" ]]; then
        echo "alerting_emails = \"$alerting_emails\"" >>"$VARIABLES_FILE"
        print_success "Email addresses for alerting added to variables.tfvars."
    else
        print_success "Email addresses for alerting not provided."
        echo "alerting_emails = \"\"" >>"$VARIABLES_FILE"
    fi
else
    print_success "Email addresses for alerting already provided."
fi

# ======================================================================
# STEP 2: Apply Terraform
# ======================================================================

pushd $ROOT_PATH/scripts/backend >/dev/null
    print_success "Installing dependencies and transpiling the backend..."
    chmod +x ./install.sh >/dev/null
    ./install.sh
    chmod +x ./transpile.sh >/dev/null
    ./transpile.sh $ENVIRONMENT
popd >/dev/null

pushd $ROOT_PATH/infra/terraform/environments/$ENVIRONMENT >/dev/null
    print_success "Applying Terraform configuration for $ENVIRONMENT environment..."
    terraform init -upgrade -backend-config $BACKEND_FILE
    terraform apply -var-file $VARIABLES_FILE -auto-approve
popd >/dev/null

# ======================================================================
# STEP 3: Deploy the frontend
# ======================================================================

if [ ! "$SKIP_FRONTEND" = "true" ]; then
    pushd $ROOT_PATH/scripts/frontend >/dev/null
    print_success "Deploying the frontend for $ENVIRONMENT..."
    chmod +x ./build-deploy.sh >/dev/null
    ./build-deploy.sh tf $ENVIRONMENT
    popd >/dev/null
fi
