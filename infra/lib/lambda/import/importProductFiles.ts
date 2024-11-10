import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3 } from "aws-sdk";

const s3 = new S3({ region: process.env.AWS_REGION });
const bucketName = process.env.BUCKET_NAME || "";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.log("[importProductsFile] event:", JSON.stringify(event));
    const name = event.queryStringParameters?.name;

    if (!name) {
      return {
        body: JSON.stringify({ message: "File name is missing" }),
        statusCode: 400,
        headers,
      };
    }

    if (!name.endsWith(".csv")) {
      return {
        body: JSON.stringify({
          message: "Wrong file extension, only .csv is supported",
        }),
        statusCode: 400,
        headers,
      };
    }

    const signedUrl = await s3.getSignedUrlPromise("putObject", {
      Bucket: bucketName,
      Key: `uploaded/${name}`,
      Expires: 300,
      ContentType: "text/csv",
    });

    return {
      body: JSON.stringify({ signedUrl }),
      statusCode: 200,
      headers,
    };
  } catch (e) {
    console.error("[importProductsFile] error:", e);

    return {
      body: JSON.stringify({
        message: "Internal Server Error",
      }),
      statusCode: 500,
      headers,
    };
  }
}