import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { Construct } from 'constructs';

export class ProductServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const getProductsListLambda = new lambda.Function(this, 'GetProductsListHandler', {
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 1024,
            timeout: cdk.Duration.seconds(5),
            handler: 'getProductsList.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, './lambda')),
        });

        const api = new apigateway.RestApi(this, "ProductServiceApi", {
            restApiName: "Product Service",
            description: "This API serves the Lambda functions for Product Service."
        });

        const getProductsListLambdaIntegration = new apigateway.LambdaIntegration(getProductsListLambda, {});

        const products = api.root.addResource('products');
        products.addMethod('GET', getProductsListLambdaIntegration);
        products.addCorsPreflight({
            allowOrigins: apigateway.Cors.ALL_ORIGINS,
            allowMethods: apigateway.Cors.ALL_METHODS, // Or specify ['GET', 'POST', etc.]
            allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
        });

        const getProductsByIdLambda = new lambda.Function(this, 'GetProductsByIdHandler', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'getProductsById.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, './lambda')),
        });

        const getProductsByIdLambdaIntegration = new apigateway.LambdaIntegration(getProductsByIdLambda, {});


        const singleProduct = products.addResource('{productId}');
        singleProduct.addMethod('GET', getProductsByIdLambdaIntegration);
        singleProduct.addCorsPreflight({
            allowOrigins: apigateway.Cors.ALL_ORIGINS,
            allowMethods: apigateway.Cors.ALL_METHODS, // Or specify ['GET', 'POST', etc.]
            allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
        });
    }
}