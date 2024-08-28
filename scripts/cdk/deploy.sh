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
