#!/bin/bash
# This script is responsible for building all lambda dependencies for terraform.

set -e

BACKEND_DIR=$(dirname "$0")/../../backend
CHECKSUM_OLD_PATH=tmp/checksum_package-json_old.txt
CHECKSUM_NEW_PATH=tmp/checksum_package-json_new.txt

pushd $BACKEND_DIR >/dev/null 2>&1

    # let's create a checksum of the package.json
    mkdir -p tmp
    md5sum package.json >$CHECKSUM_NEW_PATH

    if [ -f $CHECKSUM_OLD_PATH ]; then
        set +e
        CHECKSUM_DIFF=$(diff $CHECKSUM_OLD_PATH $CHECKSUM_NEW_PATH || true)
        if [ -z "$CHECKSUM_DIFF" ]; then
          echo "No changes detected. Skipping install. 🟢"
          exit 0
      else
          echo "Checksum has changed 🧪"
        fi
        set -e
    fi


    mkdir -p out
    mkdir -p dist
    rm -rf out/nodejs/node_modules
    pnpm install --shamefully-hoist --force
    cp package.json out
    pushd out
        pnpm install --shamefully-hoist --force --production
        rm -rf layer/nodejs/node_modules
        mkdir -p layer/nodejs
        mv node_modules layer/nodejs/
        pushd layer
            zip -rq ../../dist/dependencies.zip nodejs
        popd
    popd


    cat $CHECKSUM_NEW_PATH > $CHECKSUM_OLD_PATH

popd >/dev/null

echo "Install complete. 🟢"