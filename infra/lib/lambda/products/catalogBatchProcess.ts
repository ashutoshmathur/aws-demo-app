import { BatchWriteItemCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSEvent } from "aws-lambda";
import { SNS } from "aws-sdk";
import { randomUUID } from "crypto";
import { marshall } from "@aws-sdk/util-dynamodb";
import { NewProductSchema } from "./productsValidationSchema";

const sns = new SNS({ region: process.env.AWS_REGION });
const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const productsTableName = process.env.PRODUCTS_TABLE_NAME || "";
const stockTableName = process.env.STOCK_TABLE_NAME || "";
const snsTopicArn = process.env.SNS_TOPIC_ARN || "";

export async function handler(event: SQSEvent): Promise<void> {
    console.log("[catalogBatchProcess] event:", JSON.stringify(event));

    const products = event.Records.map(record => JSON.parse(record.body || '{}'))
        .map(product => ({
            ...product,
            price: +product.price,
            count: +product.count,
        }))
        .filter(product => NewProductSchema.safeParse(product).success);

    console.log("Valid products: ", products);

    if (products.length === 0) {
        console.log("No valid products to save");
        return;
    }

    const itemsWithIds = products.map(product => ({
        ...product,
        id: randomUUID(),
    }));

    await Promise.all([
        writeItemsToDynamoDB(itemsWithIds, productsTableName, ['id', 'description', 'price', 'title']),
        writeItemsToDynamoDB(itemsWithIds, stockTableName, ['id', 'count'], 'productId')
    ]);

    await publishSnsMessage(products);
}

export async function writeItemsToDynamoDB(items: any[], tableName: string, attributes: string[], idFieldName: string = 'id') {
    const batchWriteCommand = new BatchWriteItemCommand({
        RequestItems: {
            [tableName]: items.map(item => ({
                PutRequest: {
                    Item: marshall(Object.fromEntries(attributes.map(attr => [attr === 'id' ? idFieldName : attr, item[attr]])))
                },
            })),
        },
    });

    await dynamoDB.send(batchWriteCommand);
}

export async function publishSnsMessage(products: any[]) {
    const result = await sns.publish({
        TopicArn: snsTopicArn,
        Message: JSON.stringify({ message: "Products created successfully", products }),
        MessageAttributes: {
            newProductsAdded: {
                DataType: "String",
                StringValue: products.map(p => p.name).join(", "),
            },
            lowStockProducts: {
                DataType: "String",
                StringValue: products.filter((p) => p.count <= 100).join(", "),
            },
        },
    }).promise();
    
    console.log("SNS message sent:", result);
}
