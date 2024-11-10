import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { randomUUID } from "crypto";
import { NewProductSchema } from "./productsValidationSchema";
import { marshall } from "@aws-sdk/util-dynamodb";

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
    console.log("[createProduct] event:", JSON.stringify(event));
    const body = event.body ? JSON.parse(event.body) : {};
    const validationResult = NewProductSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        body: JSON.stringify({
          message: validationResult.error,
        }),
        statusCode: 400,
        headers,
      };
    }

    const product = {
      ...body,
      id: randomUUID(),
    };

    const putProduct = new PutItemCommand({
      TableName: productsTableName,
      Item: marshall({
        id: product.id,
        price: product.price,
        title: product.title,
        description: product.description,
      }),
    });

    const putStock = new PutItemCommand({
      TableName: stockTableName,
      Item: marshall({
        product_id: product.id,
        count: product.count,
      }),
    });

    console.log("[createProduct] product:", JSON.stringify(product));

    await Promise.all([dynamoDB.send(putProduct), dynamoDB.send(putStock)]);

    return {
      body: JSON.stringify(product),
      statusCode: 200,
      headers,
    };
  } catch (e) {
    console.error("[createProduct] error:", e);

    return {
      body: JSON.stringify({
        message: "Internal Server Error",
      }),
      statusCode: 500,
      headers,
    };
  }
}