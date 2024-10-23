import * as cdk from "aws-cdk-lib";
import * as path from "path";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from "constructs";
import { PRODUCTS_TABLE_NAME, STOCK_TABLE_NAME } from "./constants";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as customResources from "aws-cdk-lib/custom-resources";

export class ProductsDBStack extends cdk.Stack {
  // readonly productsTable: cdk.aws_dynamodb.Table;
  // readonly stockTable: cdk.aws_dynamodb.Table;
  readonly productsTable: dynamodb.ITable
  readonly stockTable: dynamodb.ITable;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // this.productsTable = new dynamodb.Table(this, PRODUCTS_TABLE_NAME, {
    //   tableName: PRODUCTS_TABLE_NAME,
    //   partitionKey: {
    //     name: "id",
    //     type: dynamodb.AttributeType.STRING,
    //   },
    // });

    // this.stockTable = new dynamodb.Table(this, STOCK_TABLE_NAME, {
    //   tableName: STOCK_TABLE_NAME,
    //   partitionKey: {
    //     name: "product_id",
    //     type: dynamodb.AttributeType.STRING,
    //   },
    // });

    // Reference existing products table
    this.productsTable = dynamodb.Table.fromTableName(this, 'ExistingProductsTable', PRODUCTS_TABLE_NAME);

    // Reference existing stock table
    this.stockTable = dynamodb.Table.fromTableName(this, 'ExistingStockTable', STOCK_TABLE_NAME);

    // const initDataLambda = new lambda.Function(this, "initializeDB", {
    //   runtime: lambda.Runtime.NODEJS_20_X,
    //   memorySize: 128,
    //   timeout: cdk.Duration.seconds(5),
    //   handler: "initializeDB.handler",
    //   code: lambda.Code.fromAsset(path.join(__dirname, "./lambda/utils")),
    //   environment: {
    //     PRODUCTS_TABLE_NAME,
    //     STOCK_TABLE_NAME,
    //   },
    // });

    // this.productsTable.grantReadWriteData(initDataLambda);
    // this.stockTable.grantReadWriteData(initDataLambda);

    // const provider = new customResources.Provider(this, "InitDataProvider", {
    //   onEventHandler: initDataLambda,
    // });

    // new cdk.CustomResource(this, "InitDataResource", {
    //   serviceToken: provider.serviceToken,
    // });
  }
}