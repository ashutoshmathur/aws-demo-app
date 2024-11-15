import {
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_s3_notifications as s3notifs,
  aws_apigateway as apigateway,
  aws_lambda as lambda,
  aws_iam as iam,
  Stack, StackProps, CfnOutput, RemovalPolicy, Duration
} from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import path = require('path');

export class ImportServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id);

    const utilitiesLayer = this.createLayer('UtilitiesLayer', 'lambda/layers/utilities');
    const lambdaRole = this.createLambdaRole();
    const importBucket = this.createImportBucket();
    this.deployPlaceholderFile(importBucket);
    this.exportBucketName(importBucket);

    const api = this.createApiGateway();
    const importResource = api.root.addResource("import");
    
    const importProductsFileLambda = this.createLambdaFunction("importProductsFile", importBucket, utilitiesLayer, lambdaRole);
    this.attachMethodsToResource(importResource, importProductsFileLambda, "GET");

    const importFileParserLambda = this.createLambdaFunction("importFileParser", importBucket, utilitiesLayer, lambdaRole);
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

  private createLambdaFunction(id: string, bucket: s3.Bucket, layer: lambda.LayerVersion, role: iam.Role): NodejsFunction {
    const lambdaFunction = new NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: Duration.seconds(5),
      handler: `${id}.handler`,
      code: lambda.Code.fromAsset(path.join(__dirname, "./lambda/import")),
      environment: { BUCKET_NAME: bucket.bucketName },
      layers: [layer],
      bundling: { externalModules: ['zod', 'csv-parser', 'aws-sdk'] },
      role
    });
    return lambdaFunction;
  }

  private attachMethodsToResource(resource: apigateway.Resource, lambdaFunction: NodejsFunction, method: string) {
    const lambdaIntegration = new apigateway.LambdaIntegration(lambdaFunction);
    resource.addMethod(method, lambdaIntegration);
  }

  private setupNotificationForBucket(bucket: s3.Bucket, lambdaFunction: lambda.IFunction) {
    bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3notifs.LambdaDestination(lambdaFunction), { prefix: "uploaded/" });
  }

}