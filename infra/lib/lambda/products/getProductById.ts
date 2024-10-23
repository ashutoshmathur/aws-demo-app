import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoDB);
const productsTableName = process.env.PRODUCTS_TABLE_NAME || "";
const stockTableName = process.env.STOCK_TABLE_NAME || "";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.log("[getProductById] event:", JSON.stringify(event));
    const { product_id } = event.pathParameters || {};

    if (!product_id) {
      return {
        body: JSON.stringify({
          message: "Product id was not provided",
        }),
        statusCode: 400,
        headers,
      };
    }

    const getProductCommand = new GetCommand({
      TableName: productsTableName,
      Key: {
        id: product_id,
      },
    });

    const productResponse = await docClient.send(getProductCommand);

    console.log("[getProductById] product:", JSON.stringify(productResponse));

    if (productResponse.Item) {
      const getStockCommand = new GetCommand({
        TableName: stockTableName,
        Key: {
          product_id,
        },
      });
      const stockResponse = await docClient.send(getStockCommand);

      console.log("[getProductById] stock:", JSON.stringify(stockResponse));

      return {
        body: JSON.stringify({
          ...productResponse.Item,
          count: stockResponse.Item?.count || 0,
        }),
        statusCode: 200,
        headers,
      };
    } else {
      return {
        body: JSON.stringify({
          message: `Product id "${product_id}" was not found`,
        }),
        statusCode: 404,
        headers,
      };
    }
  } catch (e) {
    console.error("[getProductById] error:", e);

    return {
      body: JSON.stringify({
        message: "Internal Server Error",
      }),
      statusCode: 500,
      headers,
    };
  }
}