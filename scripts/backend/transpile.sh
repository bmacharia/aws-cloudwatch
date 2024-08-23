#!/bin/bash
# This script is responsible for transpiling all TypeScript files in the backend directory to JavaScript.

set -e

SCRIPT_PATH="$(dirname "$(realpath "$0")")"
ROOT_PATH=${SCRIPT_PATH}/../..
BACKEND_DIR=${ROOT_PATH}/backend
CHECKSUM_OLD_PATH=${BACKEND_DIR}/tmp/checksum_files_old.txt
CHECKSUM_NEW_PATH=${BACKEND_DIR}/tmp/checksum_files_new.txt

ENVIRONMENT=$1

ENV_FILE=${ROOT_PATH}/.env.${ENVIRONMENT}

# create the env file if it doesn't exist
if [ ! -f $ENV_FILE ]; then
    touch $ENV_FILE
fi

pushd $BACKEND_DIR >/dev/null 2>&1

  # let's create a checksum of all files except for the node_modules
  mkdir -p tmp
  find . -type f \( -not -path "./node_modules/*" -and -not -path "./out/*" -and -not -path "./dist/*" -and -not -path "./tmp/*" \) -exec md5sum {} + | sort | md5sum >$CHECKSUM_NEW_PATH

  if [ -f $CHECKSUM_OLD_PATH ]; then
      set +e
      CHECKSUM_DIFF=$(diff $CHECKSUM_OLD_PATH $CHECKSUM_NEW_PATH || true)
      if [ -z "$CHECKSUM_DIFF" ]; then
          echo "No changes detected. Skipping transpilation. 🟢"
          exit 0
      else
          echo "Checksum has changed 🧪"
      fi
      set -e
  fi

  echo "Transpiling TypeScript files..."

  # compiling everything to plain javascript
  $BACKEND_DIR/node_modules/.bin/tsc
  
  # create target dist folder
  mkdir -p dist >/dev/null 2>&1

  # put all canaries directly in the dist folder
  echo "Packaging canaries..."
  pushd $BACKEND_DIR/lambda/canaries > /dev/null 2>&1
    find nodejs/node_modules -type f -name "*.js" | while IFS= read -r file; do
      zipname="${file#nodejs/node_modules/}"
      zipname="${zipname//\//_}"
      zipname="${zipname%.js}"
      zip -rq "$BACKEND_DIR/dist/${zipname}.zip" "$file"
    done
  popd >/dev/null 2>&1

  # loop over all lambda functions and bundle them into a ZIP file
  for LAMBDA in $(find out -type f -name "*.js" -maxdepth 1 | awk -F/ '{print $2}' | sed 's/.js$//' | sort -u); do
      # Add all nested folders inside the dist directory to the ZIP file
      # except for the node_modules
      find out -type d -not -path "*/layer*" -mindepth 1 -exec zip -r dist/$LAMBDA.zip {} \; >/dev/null 2>&1

      # Add the api-rest.js file in the dist directory to the ZIP file
      zip -r dist/$LAMBDA.zip out/$LAMBDA.js >/dev/null 2>&1
  done

  cat $CHECKSUM_NEW_PATH >$CHECKSUM_OLD_PATH

popd >/dev/null 2>&1

echo "Transpilation complete. 🟢"
