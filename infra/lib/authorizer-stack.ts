
import { Duration, Stack, type StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import path = require("path");
import * as dotenv from "dotenv";

dotenv.config();

export class AuthorizerStack extends Stack {
  basicAuthorizerLambda: lambda.Function;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.basicAuthorizerLambda = new lambda.Function(this, "basicAuthorizer", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: Duration.seconds(30),
      handler: "basicAuthorizer.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "./lambda/authorizer")
      ),
      environment: {
        USERNAME: process.env.USERNAME || "",
        PASSWORD: process.env.PASSWORD || "",
      },
    });
  }
}