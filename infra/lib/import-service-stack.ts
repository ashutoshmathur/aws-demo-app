import {
  aws_s3,
  RemovalPolicy,
  aws_s3_deployment,
  CfnOutput,
  Stack,
  StackProps,
  Duration,
  aws_s3_notifications,
} from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from "constructs";
import path = require("path");

export class ImportServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id);

    const utilitiesLayer = this.createLayer('UtilitiesLayer', 'lambda/layers/utilities');

    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole') // If your Lambda needs VPC access
      ],
    });

    // Explicitly allow Lambda to use the specific layer version if necessary
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:GetLayerVersion'],
      resources: [utilitiesLayer.layerVersionArn],
    }));

    const importBucket = new aws_s3.Bucket(this, "ImportServiceBucket", {
      autoDeleteObjects: true,
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [aws_s3.HttpMethods.PUT],
          allowedHeaders: ["*"],
        },
      ],
    });

    new aws_s3_deployment.BucketDeployment(this, "UploadFolderDeployment", {
      destinationBucket: importBucket,
      destinationKeyPrefix: "uploaded/",
      sources: [
        aws_s3_deployment.Source.data(
          ".placeholder",
          "This is a placeholder file"
        ),
      ],
    });

    new CfnOutput(this, "ImportServiceBucketName", {
      value: importBucket.bucketName,
      description: "The name of the S3 bucket",
      exportName: "ImportServiceBucketName",
    });

    const api = new apigateway.RestApi(this, "import-api", {
      restApiName: "My Import API Gateway",
      description: "This API serves the Import Lambda functions.",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const importResource = api.root.addResource("import");
    const importProductsFileLambda = new NodejsFunction(
      this,
      "importProductsFile",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 128,
        timeout: Duration.seconds(5),
        handler: "importProductsFile.handler",
        code: lambda.Code.fromAsset(path.join(__dirname, "./lambda/import")),
        environment: {
          BUCKET_NAME: importBucket.bucketName,
        },
        layers: [utilitiesLayer],
        bundling: {
          externalModules: ['zod', 'csv-parser', 'aws-sdk'],
        },
        role: lambdaRole
      }
    );
    importBucket.grantPut(importProductsFileLambda);
    const importProductsFileLambdaIntegration =
      new apigateway.LambdaIntegration(importProductsFileLambda);
    importResource.addMethod("GET", importProductsFileLambdaIntegration);

    const importFileParserLambda = new NodejsFunction(
      this,
      "importFileParser",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 128,
        timeout: Duration.seconds(5),
        handler: "importFileParser.handler",
        code: lambda.Code.fromAsset(path.join(__dirname, "./lambda/import")),
        layers: [utilitiesLayer],
        bundling: {
          externalModules: ['zod', 'csv-parser', 'aws-sdk'],
        },
        role: lambdaRole
      }
    );
    importBucket.grantReadWrite(importFileParserLambda);
    importBucket.addEventNotification(
      aws_s3.EventType.OBJECT_CREATED,
      new aws_s3_notifications.LambdaDestination(importFileParserLambda),
      { prefix: "uploaded/" }
    );
  }

  private createLayer(id: string, layerPath: string): lambda.LayerVersion {
    return new lambda.LayerVersion(this, id, {
      code: lambda.Code.fromAsset(path.join(__dirname, layerPath)),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X]
    });
  }
}