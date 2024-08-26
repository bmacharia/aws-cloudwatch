#!/usr/bin/env bash
# This script builds and deploys the frontend.

# Get the script path
ROOT_PATH=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/../..

IAC_PROVIDER=$1
ENVIRONMENT=$2

# Exit on error
set -e

# Check if provider is either "cdk" or "terraform"
if [ "$IAC_PROVIDER" != "cdk" ] && [ "$IAC_PROVIDER" != "tf" ]; then
  echo "Please provide either 'cdk' or 'tf' as the first argument."
  exit 1
fi

# Check if env is either dev or prod
if [ -z "$ENVIRONMENT" ];then
  ENVIRONMENT=dev
  echo "No environment specified, defaulting to '$ENVIRONMENT'."
fi

ENV_FILE="$ROOT_PATH/.env.$ENVIRONMENT"

# Get logged-in AWS Account ID via STS
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region us-east-1)

# check if our environment file is there
if [ ! -f $ENV_FILE ] && [ "$IAC_PROVIDER" = "tf" ]; then
  echo "Could not find environment file $ROOT_PATH/.env.$ENVIRONMENT. Please run Terraform once."
  exit 1
fi

# In CDK we need to get the environment variables from the CloudFormation stack
if [ "$IAC_PROVIDER" = "cdk" ]; then
  echo "Fetching CloudFormation outputs for CDK deployment..."

  # Fetch CloudFormation outputs
  APIGW_WS=$(aws cloudformation describe-stacks --stack-name $ENVIRONMENT-ApiStack --query "Stacks[0].Outputs[?ExportName=='wss-api-url'].OutputValue" --output text --region us-east-1)
  APIGW_REST=$(aws cloudformation describe-stacks --stack-name $ENVIRONMENT-ApiStack --query "Stacks[0].Outputs[?ExportName=='rest-api-url'].OutputValue" --output text --region us-east-1)
  RUM_GUEST_ROLE_ARN=$(aws cloudformation describe-stacks --stack-name $ENVIRONMENT-MonitoringStack --query "Stacks[0].Outputs[?ExportName=='rum-guest-role'].OutputValue" --output text --region us-east-1)
  RUM_IDENTITY_POOL_ID=$(aws cloudformation describe-stacks --stack-name $ENVIRONMENT-MonitoringStack --query "Stacks[0].Outputs[?ExportName=='rum-identity-pool-id'].OutputValue" --output text --region us-east-1)
  RUM_APP_MONITOR_ID=$(aws cloudformation describe-stacks --stack-name $ENVIRONMENT-MonitoringStack --query "Stacks[0].Outputs[?ExportName=='rum-app-monitor-id'].OutputValue" --output text --region us-east-1)

  # print both variables
  echo "NEXT_PUBLIC_APIGW_WS: $APIGW_WS"
  echo "NEXT_PUBLIC_APIGW_REST: $APIGW_REST"
  echo "RUM_GUEST_ROLE_ARN: $RUM_GUEST_ROLE_ARN"
  echo "RUM_IDENTITY_POOL_ID: $RUM_IDENTITY_POOL_ID"
  echo "RUM_APP_MONITOR_ID: $RUM_APP_MONITOR_ID"

  # Check and add WSS_API_URL to the ENV_FILE
  if ! grep -q "NEXT_PUBLIC_APIGW_WS=" "$ENV_FILE"; then
    echo "NEXT_PUBLIC_APIGW_WS=$APIGW_WS" >>"$ENV_FILE"
  else
    sed -i'' -e "s#^NEXT_PUBLIC_APIGW_WS=.*#NEXT_PUBLIC_APIGW_WS=$APIGW_WS#" "$ENV_FILE"
  fi

  # Check and add REST_API_URL to the ENV_FILE
  if ! grep -q "NEXT_PUBLIC_APIGW_REST=" "$ENV_FILE"; then
    echo "NEXT_PUBLIC_APIGW_REST=$APIGW_REST" >>"$ENV_FILE"
  else
    sed -i'' -e "s#^NEXT_PUBLIC_APIGW_REST=.*#NEXT_PUBLIC_APIGW_REST=$APIGW_REST#" "$ENV_FILE"
  fi

  if ! grep -q "NEXT_PUBLIC_RUM_GUEST_ROLE_ARN=" "$ENV_FILE"; then
    echo "NEXT_PUBLIC_RUM_GUEST_ROLE_ARN=$RUM_GUEST_ROLE_ARN" >>"$ENV_FILE"
  else
    sed -i'' -e "s#^NEXT_PUBLIC_RUM_GUEST_ROLE_ARN=.*#NEXT_PUBLIC_RUM_GUEST_ROLE_ARN=$RUM_GUEST_ROLE_ARN#" "$ENV_FILE"
  fi

  if ! grep -q "NEXT_PUBLIC_RUM_IDENTITY_POOL_ARN=" "$ENV_FILE"; then
    echo "NEXT_PUBLIC_RUM_IDENTITY_POOL_ARN=$RUM_IDENTITY_POOL_ID" >>"$ENV_FILE"
  else
    sed -i'' -e "s#^NEXT_PUBLIC_RUM_IDENTITY_POOL_ARN=.*#NEXT_PUBLIC_RUM_IDENTITY_POOL_ARN=$RUM_IDENTITY_POOL_ID#" "$ENV_FILE"
  fi

  if ! grep -q "NEXT_PUBLIC_RUM_MONITOR_ID=" "$ENV_FILE"; then
    echo "NEXT_PUBLIC_RUM_MONITOR_ID=$RUM_APP_MONITOR_ID" >>"$ENV_FILE"
  else
    sed -i'' -e "s#^NEXT_PUBLIC_RUM_MONITOR_ID=.*#NEXT_PUBLIC_RUM_MONITOR_ID=$RUM_APP_MONITOR_ID#" "$ENV_FILE"
  fi

fi

# Continue with the rest of your deployment script...

# add the app build timestamp to the environment file
# if there's already a timestamp, it will be overwritten
TS_KEY="NEXT_PUBLIC_APP_BUILD_TIMESTAMP"

if grep -q "^$TS_KEY=" "$ENV_FILE"; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    TS_VALUE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    sed -i '' "s/^$TS_KEY=.*/$TS_KEY=$TS_VALUE/" "$ENV_FILE"
  else
    TS_VALUE=$(date --iso-8601=seconds)
    sed -i "s/^$TS_KEY=.*/$TS_KEY=$TS_VALUE/" "$ENV_FILE"
  fi
else
  if [[ "$OSTYPE" == "darwin"* ]]; then
    TS_VALUE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  else
    TS_VALUE=$(date --iso-8601=seconds)
  fi
  echo "$TS_KEY=$TS_VALUE" >>"$ENV_FILE"
fi

# Export variables in our .env.$ENV file
# and build the next app
pushd $ROOT_PATH/frontend >/dev/null
# install packages if they are not there already
if [ ! -d "node_modules" ]; then
  pnpm install
fi
env $(cat $ENV_FILE | xargs) pnpm run build
popd >/dev/null

if [ "$IAC_PROVIDER" = "cdk" ]; then
  BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name $ENVIRONMENT-FrontendHostingStack --query "Stacks[0].Outputs[?ExportName=='frontend-bucket-name'].OutputValue" --output text --region us-east-1)
  echo "Bucket Name: $BUCKET_NAME"
fi

if [ "$IAC_PROVIDER" = "tf" ]; then
  BUCKET_NAME=$(aws s3api list-buckets --query "Buckets[?starts_with(Name, 'cw-ho-$IAC_PROVIDER-$ENVIRONMENT-frontend')].Name" --output text --region us-east-1)
fi

if [ -z "$BUCKET_NAME" ]; then
  echo "Could not find bucket for environment $IAC_PROVIDER-$ENVIRONMENT. Please make sure it exists."
  exit 1
fi

# Deploy next app via S3 Sync
aws s3 sync $ROOT_PATH/frontend/out s3://$BUCKET_NAME --delete --region us-east-1

# Get CloudFront distribution ID
CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[].{ID:Id,DomainName:DomainName,Origin:Origins.Items[0].DomainName}' \
  --output text --region us-east-1 | grep $BUCKET_NAME | cut -f2)

CLOUDFRONT_URL=$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[].{ID:Id,DomainName:DomainName,Origin:Origins.Items[0].DomainName}' \
  --output text --region us-east-1 | grep $BUCKET_NAME | cut -f1)

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*" --region us-east-1 >/dev/null

# Print Distribution URL
echo "Distribution URL: $CLOUDFRONT_URL"
