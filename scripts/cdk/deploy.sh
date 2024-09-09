#!/usr/bin/env bash

ROOT_PATH=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/../..

VARIABLES_FILE="$ROOT_PATH/infra/cdk/variables.env"

source "$ROOT_PATH/scripts/utils.sh"

check_preconditions
set_environment "$1"

# ======================================================================
# STEP 1: Apply CDK
# ======================================================================

# let's check if an account id is already provided
# if not, we'll check the current AWS session and extract
# it from there. We also ask the user if they want to
# use this account id.
if [ ! -f "$VARIABLES_FILE" ] || ! grep -q 'aws_account_id' "$VARIABLES_FILE" >/dev/null 2>&1; then
    aws_account_id=$(aws sts get-caller-identity --query Account --output text)
    # check if we're even logged in
    if [[ -z "$aws_account_id" ]]; then
        print_error "You are not logged into your AWS account."
        exit 1
    fi
    read -p "Use AWS account id $aws_account_id? (y/n): " use_aws_account_id
    if [[ "$use_aws_account_id" == "y" ]]; then
        echo "aws_account_id = $aws_account_id" >>"$VARIABLES_FILE"
        print_success "AWS account id added to variables.env."
    else
        print_error "Please log into the correct AWS account and retry this."
        exit 1
    fi
else
    print_success "AWS account id already provided."
fi

# Prompt the user if they want to enable basic auth
if ! grep -q 'basic_auth_enabled' "$VARIABLES_FILE"; then
    read -p "Enable basic auth? (y/n, default is n): " enable_basic_auth
    enable_basic_auth=${enable_basic_auth:-n}
    if [[ "$enable_basic_auth" == "y" ]]; then
        echo "basic_auth_enabled = true" >>"$VARIABLES_FILE"
        print_success "Basic auth enabled and added to variables.env."
    else
        echo "basic_auth_enabled = false" >>"$VARIABLES_FILE"
        print_success "Basic auth not enabled."
    fi
else
    print_success "Basic auth setting already provided."
fi

if grep -q 'basic_auth_enabled = true' "$VARIABLES_FILE"; then
    if ! grep -q 'basic_auth_username' "$VARIABLES_FILE"; then
        read -p "Enter username for basic authentication (default is cw-pro): " basic_auth_username
        basic_auth_username=${basic_auth_username:-cw-pro}
        echo "basic_auth_username = \"$basic_auth_username\"" >>"$VARIABLES_FILE"
        print_success "Basic auth username added to variables.env."
    else
        print_success "Basic auth username already provided."
    fi

    if ! grep -q 'basic_auth_password' "$VARIABLES_FILE"; then
        basic_auth_password=$(openssl rand -base64 6)
        read -p "Enter password for basic authentication (default is a random 8 char string): " input_password
        basic_auth_password=${input_password:-$basic_auth_password}
        echo "basic_auth_password = \"$basic_auth_password\"" >>"$VARIABLES_FILE"
        print_success "Basic auth password added to variables.env."
    else
        print_success "Basic auth password already provided."
    fi
fi



AWS_ACCOUNT_ID=$(grep -o "aws_account_id = [0-9]*" $VARIABLES_FILE | grep -o "[0-9]*")
check_account_id "$AWS_ACCOUNT_ID"

pushd $ROOT_PATH/infra/cdk >/dev/null
# if there are no node_modules, install them via pnpm
if [ ! -d "node_modules" ]; then
    pnpm install
fi
print_success "Applying CDK configuration for $ENVIRONMENT environment..."
pnpm cdk bootstrap
pnpm cdk deploy "${ENVIRONMENT}/*" --require-approval never --concurrency 10
popd >/dev/null

# ======================================================================
# STEP 2: Deploy the frontend
# ======================================================================

if [ ! "$SKIP_FRONTEND" = "true" ]; then
    pushd $ROOT_PATH/scripts/frontend >/dev/null
    print_success "Deploying the frontend for $ENVIRONMENT..."
    chmod +x ./build-deploy.sh >/dev/null
    ./build-deploy.sh cdk $ENVIRONMENT
    popd >/dev/null
fi
