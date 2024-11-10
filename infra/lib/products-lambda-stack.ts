import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from "constructs";
import { PRODUCTS_TABLE_NAME, STOCK_TABLE_NAME } from "./constants";
import { ProductsApiStack } from "./products-api-stack";
import { ProductsDBStack } from "./products-db-stack";

interface ProductsLambdaStackProps extends cdk.StackProps {
  productsApiStack: ProductsApiStack;
  productsDBStack: ProductsDBStack;
}

export class ProductsLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProductsLambdaStackProps) {
    super(scope, id, props);

    const productsResource = props.productsApiStack.api.root.addResource("products");

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

    const getProductsListLambda = new NodejsFunction(this, "getProductsList", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      handler: "getProductsList.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "./lambda/products")),
      environment: {
        PRODUCTS_TABLE_NAME,
        STOCK_TABLE_NAME,
      },
      layers: [utilitiesLayer],
      bundling: {
        externalModules: ['zod'],
      },
      role: lambdaRole
    });
    const createProductLambda = new NodejsFunction(
      this,
      "createProductLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 128,
        timeout: cdk.Duration.seconds(5),
        handler: "createProduct.handler",
        code: lambda.Code.fromAsset(path.join(__dirname, "./lambda/products")),
        environment: {
          PRODUCTS_TABLE_NAME,
          STOCK_TABLE_NAME,
        },
        layers: [utilitiesLayer],
        bundling: {
          externalModules: ['zod'],
        },
        role: lambdaRole
      }
    );
    props.productsDBStack.productsTable.grantReadData(getProductsListLambda);
    props.productsDBStack.stockTable.grantReadData(getProductsListLambda);
    props.productsDBStack.productsTable.grantWriteData(createProductLambda);
    props.productsDBStack.stockTable.grantWriteData(createProductLambda);
    const getProductsListLambdaIntegration = new apigateway.LambdaIntegration(
      getProductsListLambda
    );
    const createProductLambdaIntegration = new apigateway.LambdaIntegration(
      createProductLambda
    );
    productsResource.addMethod("GET", getProductsListLambdaIntegration);
    productsResource.addMethod("POST", createProductLambdaIntegration);

    const oneProductResource = productsResource.addResource("{product_id}");
    const getProductByIdLambda = new NodejsFunction(this, "getProductById", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      handler: "getProductById.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "./lambda/products")),
      environment: {
        PRODUCTS_TABLE_NAME,
        STOCK_TABLE_NAME,
      },
      layers: [utilitiesLayer],
      bundling: {
        externalModules: ['zod'],
      },
      role: lambdaRole
    });
    props.productsDBStack.productsTable.grantReadData(getProductByIdLambda);
    props.productsDBStack.stockTable.grantReadData(getProductByIdLambda);
    const getProductByIdLambdaIntegration = new apigateway.LambdaIntegration(
      getProductByIdLambda
    );
    oneProductResource.addMethod("GET", getProductByIdLambdaIntegration);
  }

  private createLayer(id: string, layerPath: string): lambda.LayerVersion {
    return new lambda.LayerVersion(this, id, {
      code: lambda.Code.fromAsset(path.join(__dirname, layerPath)),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X]
    });
  }
}