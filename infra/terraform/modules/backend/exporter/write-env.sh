#!/bin/bash

set -e

ROOT_PATH=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/../../../../..


ENVIRONMENT=$1
KEY=$2
VALUE=$3
ENV_FILE="${ROOT_PATH}/.env.${ENVIRONMENT}"

if [ ! -f "$ENV_FILE" ]; then
  touch "$ENV_FILE"
fi

update_env() {
  local key="$1"
  local value="$2"
  sed -i.bak "/^$key=/d" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  echo "$key=$value" >> "$ENV_FILE"
}

update_env "$KEY" "$VALUE"