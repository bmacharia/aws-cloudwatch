#!/usr/bin/env bash

ROOT_PATH=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/..

source "$ROOT_PATH/scripts/utils.sh"

TRACK=$1

if [ "$TRACK" = 'tf' ]; then
    $ROOT_PATH/scripts/terraform/deploy.sh $2
elif [ "$TRACK" = 'cdk' ]; then
    $ROOT_PATH/scripts/cdk/deploy.sh $2
else
    print_error "Invalid track. Please use 'tf' or 'cdk'."
    exit 1
fi
