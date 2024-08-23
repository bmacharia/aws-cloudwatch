#!/usr/bin/env bash

ROOT_PATH=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/../..

VARIABLES_FILE="$ROOT_PATH/infra/terraform/environments/dev/variables.tfvars"
BACKEND_FILE="$ROOT_PATH/infra/terraform/environments/dev/backend.tfvars"
AWS_ACCOUNT_ID=$(grep 'aws_account_id' "$VARIABLES_FILE" | cut -d '"' -f 2)
ENV_FILE="$ROOT_PATH/.env.$ENVIRONMENT"

source "$ROOT_PATH/scripts/utils.sh"

set_environment "$1"
check_account_id "$AWS_ACCOUNT_ID"

# check if the user really wants do destroy the infrastructure
read -p "Are you sure you want to destroy the infrastructure for the $ENVIRONMENT environment? (y/n): " confirm
if [[ "$confirm" != "y" ]]; then
    print_error "Aborting..."
    exit 1
fi

pushd $ROOT_PATH/infra/terraform/environments/$ENVIRONMENT >/dev/null
    print_success "Applying Terraform configuration for $ENVIRONMENT environment..."
    terraform init -upgrade -backend-config $BACKEND_FILE
    # automatically approve if $AUTO_APPROVE is set to "true"
    if [ "$AUTO_APPROVE" = "true" ]; then
        terraform destroy -var-file $VARIABLES_FILE -auto-approve
    else
        terraform destroy -var-file $VARIABLES_FILE
    fi
popd >/dev/null
