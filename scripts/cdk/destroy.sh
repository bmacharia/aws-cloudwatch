#!/usr/bin/env bash

ROOT_PATH=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/../..

VARIABLES_FILE="$ROOT_PATH/infra/cdk/variables.env"
AWS_ACCOUNT_ID=$(grep -o "aws_account_id = [0-9]*" $VARIABLES_FILE | grep -o "[0-9]*")

source "$ROOT_PATH/scripts/utils.sh"

set_environment "$1"
check_account_id "$AWS_ACCOUNT_ID"

# check if the user really wants do destroy the infrastructure
read -p "Are you sure you want to destroy the infrastructure for the $ENVIRONMENT environment? (y/n): " confirm
if [[ "$confirm" != "y" ]]; then
    print_error "Aborting..."
    exit 1
fi

pushd $ROOT_PATH/infra/cdk >/dev/null
# if there are no node_modules, install them via pnpm
if [ ! -d "node_modules" ]; then
    pnpm install
fi
print_success "Applying CDK configuration for $ENVIRONMENT environment..."
pnpm cdk destroy "${ENVIRONMENT}/*" --require-approval never --concurrency 10
popd >/dev/null
