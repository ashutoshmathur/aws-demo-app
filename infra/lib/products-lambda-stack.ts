import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
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

    const productsResource =
      props.productsApiStack.api.root.addResource("products");

    const getProductsListLambda = new lambda.Function(this, "getProductsList", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      handler: "getProductsList.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "./lambda/products")),
      environment: {
        PRODUCTS_TABLE_NAME,
        STOCK_TABLE_NAME,
      },
    });
    const createProductLambda = new lambda.Function(
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
    const getProductByIdLambda = new lambda.Function(this, "getProductById", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      handler: "getProductById.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "./lambda/products")),
      environment: {
        PRODUCTS_TABLE_NAME,
        STOCK_TABLE_NAME,
      },
    });
    props.productsDBStack.productsTable.grantReadData(getProductByIdLambda);
    props.productsDBStack.stockTable.grantReadData(getProductByIdLambda);
    const getProductByIdLambdaIntegration = new apigateway.LambdaIntegration(
      getProductByIdLambda
    );
    oneProductResource.addMethod("GET", getProductByIdLambdaIntegration);
  }
}