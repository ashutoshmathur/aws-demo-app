#!/bin/bash

# Fetch the AWS account ID and the ARN (Amazon Resource Name)
aws_caller_identity=$(aws sts get-caller-identity --query "[Account, Arn]" --output text)
account_id=$(echo $aws_caller_identity | cut -f1)
arn=$(echo $aws_caller_identity | cut -f2)

# Extract the username from the ARN
# Note: This assumes your ARN includes a user path, e.g., arn:aws:iam::account-id:user/username
username=$(echo $arn | rev | cut -d'/' -f1 | rev)

# Output the account ID and username
echo "Account ID: $account_id"
echo "Username: $username"