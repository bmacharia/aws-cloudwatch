#!/usr/bin/env bash

set -e

ROOT_PATH=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/..

# Function to print success messages
print_success() {
    echo "$(tput setaf 2)$1$(tput sgr0)"
}

# Function to print error messages
print_error() {
    echo "$(tput setaf 1)$1$(tput sgr0)" >&2
}

# check if th necessary tools are installed.
# If they are missing, install them (for macOS or Linux)
#
# • npm/node
# • pnpm
# • aws-cli
# • tfenv / terraform
check_preconditions() {
    if command -v npm &>/dev/null; then
        print_success "npm is already installed."
    else
        print_error "npm is not installed."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            print_success "Installing npm..."
            brew install npm
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            if command -v apt-get &>/dev/null; then
                print_success "Installing npm..."
                sudo apt-get install -y npm
            elif command -v yum &>/dev/null; then
                print_success "Installing npm..."
                sudo yum install -y npm
            else
                print_error "Unsupported package manager."
                exit 1
            fi
        else
            print_error "Unsupported OS."
            exit 1
        fi
    fi

    if command -v pnpm &>/dev/null; then
        print_success "pnpm is already installed."
    else
        print_error "pnpm is not installed."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            print_success "Installing pnpm..."
            npm install -g pnpm
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            print_success "Installing pnpm..."
            sudo npm install -g pnpm
        else
            print_error "Unsupported OS."
            exit 1
        fi
    fi

    if command -v aws &>/dev/null; then
        print_success "aws-cli is already installed."
    else
        print_error "aws-cli is not installed."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            print_success "Installing aws-cli..."
            brew install awscli
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            if command -v apt-get &>/dev/null; then
                print_success "Installing aws-cli..."
                sudo apt-get install -y awscli
            elif command -v yum &>/dev/null; then
                print_success "Installing aws-cli..."
                sudo yum install -y aws-cli
            else
                print_error "Unsupported package manager."
                exit 1
            fi
        else
            print_error "Unsupported OS."
            exit 1
        fi
    fi

    if command -v tfenv &>/dev/null; then
        print_success "tfenv is already installed."
    else
        print_error "tfenv is not installed."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            print_success "Installing tfenv..."
            brew install tfenv
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            if command -v git &>/dev/null; then
                print_success "Installing tfenv..."
                git clone https://github.com/tfutils/tfenv.git ~/.tfenv
                echo 'export PATH="$HOME/.tfenv/bin:$PATH"' >> ~/.bash_profile
                source ~/.bash_profile
            else
                print_error "git is not installed."
                exit 1
            fi
        else
            print_error "Unsupported OS."
            exit 1
        fi
        pushd $ROOT_PATH/infra/terraform >/dev/null
            tfenv install
        popd >/dev/null
    fi
}

set_environment() {
    ENVIRONMENT=$1

    if [ -z "$ENVIRONMENT" ]; then
        export ENVIRONMENT=dev
        print_success "No environment specified, defaulting to '$ENVIRONMENT'."
    fi
}

check_account_id() {
    EXPECTED_ACCOUNT_ID=$1

    # Check if logged into AWS
    if ! aws sts get-caller-identity &>/dev/null; then
        print_error "You are not logged into AWS."
        exit 1
    fi

    AWS_ACCOUNT_ID_LOGGED_IN=$(aws sts get-caller-identity --query Account --output text)
    if [[ "$EXPECTED_ACCOUNT_ID" != "$AWS_ACCOUNT_ID_LOGGED_IN" ]]; then
        print_error "You are not logged into the AWS account $EXPECTED_ACCOUNT_ID."
        print_error "For Terraform, your AWS account id should be in the variables.tfvars file."
        print_error "For CDK, your AWS account id should be in the config.ts file."
        exit 1
    fi
}
