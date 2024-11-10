import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
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
    console.log("[getProductsList] event:", JSON.stringify(event));
    const productsCommand = new ScanCommand({
      TableName: productsTableName,
    });
    const stockCommand = new ScanCommand({
      TableName: stockTableName,
    });

    const [productsResult, stockResult] = await Promise.all([
      dynamoDB.send(productsCommand),
      dynamoDB.send(stockCommand),
    ]);

    console.log("[getProductsList] products:", JSON.stringify(productsResult));
    console.log("[getProductsList] stock:", JSON.stringify(stockResult));

    const products = productsResult.Items?.map((product) => ({
      id: product.id.S,
      count:
        stockResult.Items?.find((stock) => stock.product_id.S === product.id.S)
          ?.count.N || 0,
      price: product.price.N,
      title: product.title.S,
      description: product.description.S,
    }));

    console.log("[getProductsList] response:", JSON.stringify(products));

    return {
      body: JSON.stringify(products),
      statusCode: 200,
      headers,
    };
  } catch (e) {
    console.error("[getProductsList] error:", e);

    return {
      body: JSON.stringify({
        message: "Internal Server Error",
      }),
      statusCode: 500,
      headers,
    };
  }
}
