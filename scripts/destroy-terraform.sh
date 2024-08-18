#!/usr/bin/env bash

set -e

ROOT_PATH=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/..

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    ENVIRONMENT=dev
    echo "No environment specified, defaulting to '$ENVIRONMENT'."
fi

ENV_FILE="$ROOT_PATH/.env.$ENVIRONMENT"

# Function to print success messages
print_success() {
    echo "$(tput setaf 2)$1$(tput sgr0)"
}

# Function to print error messages
print_error() {
    echo "$(tput setaf 1)$1$(tput sgr0)" >&2
}

VARIABLES_FILE="$ROOT_PATH/infra/terraform/environments/dev/variables.tfvars"
BACKEND_FILE="$ROOT_PATH/infra/terraform/environments/dev/backend.tfvars"

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