import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as eventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as path from "path";
import { PRODUCTS_TABLE_NAME, STOCK_TABLE_NAME } from "./constants";
import { ProductsApiStack } from "./products-api-stack";
import { ProductsDBStack } from "./products-db-stack";
import { ProductsSQSStack } from "./products-sqs-stack";
import { ProductsSNSStack } from "./products-sns-stack";

interface ProductsLambdaStackProps extends cdk.StackProps {
  productsApiStack: ProductsApiStack;
  productsDBStack: ProductsDBStack;
  productsSQSStack: ProductsSQSStack;
  productsSNSStack: ProductsSNSStack;
}

export class ProductsLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProductsLambdaStackProps) {
    super(scope, id, props);

    const utilitiesLayer = this.createLayer('UtilitiesLayer', 'lambda/layers/utilities');
    const lambdaRole = this.createLambdaRole();

    const lambdaCommonProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      layers: [utilitiesLayer],
      role: lambdaRole,
      bundling: { externalModules: ['zod', 'aws-sdk'] },
      code: lambda.Code.fromAsset(path.join(__dirname, "./lambda/products")),
    };

    const productsResource = props.productsApiStack.api.root.addResource("products");

    this.setupProductLambdaHandlers(productsResource, lambdaCommonProps, props);
    this.setupCatalogBatchProcess(lambdaCommonProps, props);
  }

  private setupProductLambdaHandlers(resource: apigateway.Resource, lambdaProps: any, props: ProductsLambdaStackProps) {
    const operations = ['getProductsList', 'createProduct', 'getProductById'];
    operations.forEach(op => {
      const handlerLambda = new NodejsFunction(this, `${op}Lambda`, {
        ...lambdaProps,
        handler: `${op}.handler`,
        environment: {
          PRODUCTS_TABLE_NAME,
          STOCK_TABLE_NAME,
        },
      });

      const method = op === 'createProduct' ? 'POST' : 'GET';
      props.productsDBStack.productsTable.grantReadWriteData(handlerLambda);
      props.productsDBStack.stockTable.grantReadWriteData(handlerLambda);
      // console.log('resource', resource);
      if (op === 'getProductById') {
        const idResource = resource.addResource('{product_id}');
        idResource.addMethod('GET', new apigateway.LambdaIntegration(handlerLambda));
      } else {
        resource.addMethod(method, new apigateway.LambdaIntegration(handlerLambda));
      }
    });
  }

  private setupCatalogBatchProcess(lambdaProps: any, props: ProductsLambdaStackProps) {
    const catalogBatchProcessLambda = new NodejsFunction(this, "catalogBatchProcessLambda", {
      ...lambdaProps,
      handler: "catalogBatchProcess.handler",
      environment: {
        PRODUCTS_TABLE_NAME,
        STOCK_TABLE_NAME,
        SNS_TOPIC_ARN: props.productsSNSStack.productTopic.topicArn,
      },
    });
    props.productsSQSStack.productsQueue.grantConsumeMessages(catalogBatchProcessLambda);
    catalogBatchProcessLambda.addEventSource(new eventSources.SqsEventSource(props.productsSQSStack.productsQueue, { batchSize: 5 }));
    props.productsSNSStack.productTopic.grantPublish(catalogBatchProcessLambda);
    props.productsDBStack.productsTable.grantWriteData(catalogBatchProcessLambda);
    props.productsDBStack.stockTable.grantWriteData(catalogBatchProcessLambda);
  }

  private createLayer(id: string, layerPath: string): lambda.LayerVersion {
    return new lambda.LayerVersion(this, id, {
      code: lambda.Code.fromAsset(path.join(__dirname, layerPath)),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X]
    });
  }

  private createLambdaRole(): iam.Role {
    return new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      roleName: 'ProductsLambdaExecutionRole',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
      ],
    });
  }
}