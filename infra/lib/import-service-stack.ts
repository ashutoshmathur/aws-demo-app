import {
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_s3_notifications as s3notifs,
  aws_apigateway as apigateway,
  aws_lambda as lambda,
  aws_iam as iam,
  aws_ssm as ssm,
  aws_sqs as sqs,
  Stack, StackProps, CfnOutput, RemovalPolicy, Duration
} from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import path = require('path');
import { ProductsSQSStack } from "./products-sqs-stack";
import * as dotenv from "dotenv";

dotenv.config();

interface ImportServiceStackProps extends StackProps {
  productsSQSStack: ProductsSQSStack;
}

export class ImportServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: ImportServiceStackProps) {
    super(scope, id);

    // Retrieve the SQS Queue ARN from SSM Parameter Store
    const catalogItemsQueueArn = ssm.StringParameter.valueForStringParameter(this, '/products-sqs-stack/catalogItemsQueueArn');
    // Import the SQS Queue using its ARN
    const catalogItemsQueue = sqs.Queue.fromQueueArn(this, 'ImportedCatalogItemsQueue', catalogItemsQueueArn);
    const utilitiesLayer = this.createLayer('UtilitiesLayer', 'lambda/layers/utilities');
    const lambdaRole = this.createLambdaRole();
    const importBucket = this.createImportBucket();
    this.deployPlaceholderFile(importBucket);
    this.exportBucketName(importBucket);

    const api = this.createApiGateway();
    const importResource = api.root.addResource("import");
    const sqsQueueURL = catalogItemsQueue.queueUrl || props?.productsSQSStack?.productsQueue?.queueUrl || 'invalid-sqs-queue-url';

    const basicAuthorizerLambda = this.createBasicAuthorizerLambda();
    const authorizer = this.createAPIGatewayAuthorizer(basicAuthorizerLambda);

    const resourceOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    };
    
    const importProductsFileEnvVars = {
      BUCKET_NAME: importBucket.bucketName,
    };
    const importProductsFileLambda = this.createLambdaFunction("importProductsFile", utilitiesLayer, lambdaRole, importProductsFileEnvVars);
    this.attachMethodsToResource(importResource, importProductsFileLambda, "GET", resourceOptions);
       
    const importFileParserEnvVars = {
      QUEUE_URL: sqsQueueURL,
    };
    const importFileParserLambda = this.createLambdaFunction("importFileParser", utilitiesLayer, lambdaRole, importFileParserEnvVars);

    this. grantSendMessagesToLambda(props.productsSQSStack, importFileParserLambda);

    this.setupNotificationForBucket(importBucket, importFileParserLambda);
  }

  private createLayer(id: string, layerPath: string): lambda.LayerVersion {
    return new lambda.LayerVersion(this, id, {
      code: lambda.Code.fromAsset(path.join(__dirname, layerPath)),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X]
    });
  }

  private createLambdaRole(): iam.Role {
    // Lambda IAM Role
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      roleName: 'ImportServiceLambdaExecutionRole',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
      ],
    });
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:GetLayerVersion'],
      resources: ['*'],
    }));
    return lambdaRole;
  }

  private createImportBucket(): s3.Bucket {
    return new s3.Bucket(this, "ImportServiceBucket", {
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      cors: [{
        allowedOrigins: ["*"],
        allowedMethods: [s3.HttpMethods.PUT],
        allowedHeaders: ["*"],
      }],
    });
  }

  private deployPlaceholderFile(bucket: s3.Bucket) {
    new s3deploy.BucketDeployment(this, "UploadFolderDeployment", {
      destinationBucket: bucket,
      destinationKeyPrefix: "uploaded/",
      sources: [s3deploy.Source.data(".placeholder", "This is a placeholder file")],
    });
  }

  private exportBucketName(bucket: s3.Bucket) {
    new CfnOutput(this, "ImportServiceBucketName", {
      value: bucket.bucketName,
      description: "The name of the S3 bucket",
      exportName: "ImportServiceBucketName",
    });
  }

  private createApiGateway(): apigateway.RestApi {
    return new apigateway.RestApi(this, "import-api", {
      restApiName: "My Import API Gateway",
      description: "This API serves the Import Lambda functions.",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });
  }

  private createLambdaFunction(id: string, layer: lambda.LayerVersion, role: iam.Role, envVars: { BUCKET_NAME?: string; QUEUE_URL?: string; }): NodejsFunction {
    const lambdaFunction = new NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: Duration.seconds(5),
      handler: `${id}.handler`,
      code: lambda.Code.fromAsset(path.join(__dirname, "./lambda/import")),
      environment: envVars,
      layers: [layer],
      bundling: { externalModules: ['zod', 'csv-parser', 'aws-sdk'] },
      role
    });
    return lambdaFunction;
  }

  private attachMethodsToResource(resource: apigateway.Resource, lambdaFunction: NodejsFunction, method: string, options: apigateway.MethodOptions = {}) {
    const lambdaIntegration = new apigateway.LambdaIntegration(lambdaFunction);
    resource.addMethod(method, lambdaIntegration, options);
  }

  private setupNotificationForBucket(bucket: s3.Bucket, lambdaFunction: lambda.IFunction) {
    bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3notifs.LambdaDestination(lambdaFunction), { prefix: "uploaded/" });
  }

  private grantSendMessagesToLambda(productsSQSStack: ProductsSQSStack, lambdaFunction: lambda.IFunction) {
    productsSQSStack.productsQueue.grantSendMessages(lambdaFunction);
  }

  private createBasicAuthorizerLambda(): lambda.Function {
    const basicAuthorizerLambda = new NodejsFunction(this, "basicAuthorizer", {
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
    return basicAuthorizerLambda;
  }

  private createAPIGatewayAuthorizer(authorizerLambda: lambda.Function): apigateway.TokenAuthorizer {
    const authorizer = new apigateway.TokenAuthorizer(
      this,
      "ImportAuthorizer",
      {
        handler: authorizerLambda,
        identitySource: apigateway.IdentitySource.header("Authorization"),
        resultsCacheTtl: Duration.seconds(0),
      }
    );
    return authorizer;
  }

}