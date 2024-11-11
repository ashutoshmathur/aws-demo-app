import { handler, writeItemsToDynamoDB, publishSnsMessage } from '../catalogBatchProcess';
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { DynamoDBClient, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { SNS } from 'aws-sdk';
import { marshall } from '@aws-sdk/util-dynamodb';
import { randomUUID } from 'crypto';
import { NewProductSchema } from '../productsValidationSchema';

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('aws-sdk');
jest.mock('crypto', () => ({
    randomUUID: jest.fn(() => 'test-uuid'),
}));
jest.mock('@aws-sdk/util-dynamodb', () => ({
    marshall: jest.fn(),
}));
jest.mock('../productsValidationSchema', () => ({
    NewProductSchema: {
        safeParse: jest.fn(),
    },
}));

const mockDynamoDBClient = DynamoDBClient as jest.MockedClass<typeof DynamoDBClient>;
const mockSNS = SNS as jest.MockedClass<typeof SNS>;

describe('catalogBatchProcess', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('handler', () => {
        it('should process valid products and call DynamoDB and SNS', async () => {
            const event: SQSEvent = {
                Records: [
                    { body: JSON.stringify({ name: 'Product1', price: '10', count: '5' }) },
                    { body: JSON.stringify({ name: 'Product2', price: '20', count: '15' }) },
                ] as unknown as SQSRecord[],
            };

            (NewProductSchema.safeParse as jest.Mock).mockReturnValue({ success: true });

            const sendMock = jest.fn();
            mockDynamoDBClient.prototype.send = sendMock;
            const publishMock = jest.fn().mockReturnValue({ promise: jest.fn() });
            mockSNS.prototype.publish = publishMock;

            await handler(event);

            expect(sendMock).toHaveBeenCalledTimes(2);
            expect(publishMock).toHaveBeenCalledTimes(1);
        });

        it('should not process invalid products', async () => {
            const event: SQSEvent = {
                Records: [
                    { body: JSON.stringify({ name: 'Product1', price: 'invalid', count: '5' }) },
                ] as unknown as SQSRecord[],
            };

            (NewProductSchema.safeParse as jest.Mock).mockReturnValue({ success: false });

            const sendMock = jest.fn();
            mockDynamoDBClient.prototype.send = sendMock;
            const publishMock = jest.fn().mockReturnValue({ promise: jest.fn() });
            mockSNS.prototype.publish = publishMock;

            await handler(event);

            expect(sendMock).not.toHaveBeenCalled();
            expect(publishMock).not.toHaveBeenCalled();
        });
    });

    describe('writeItemsToDynamoDB', () => {
        it('should write items to DynamoDB', async () => {
            const items = [{ id: 'test-uuid', name: 'Product1', price: 10, count: 5 }];
            const tableName = 'ProductsTable';
            const attributes = ['id', 'name', 'price', 'count'];

            const sendMock = jest.fn();
            mockDynamoDBClient.prototype.send = sendMock;

            await writeItemsToDynamoDB(items, tableName, attributes);

            expect(sendMock).toHaveBeenCalledWith(expect.any(BatchWriteItemCommand));
        });
    });

    describe('publishSnsMessage', () => {
        it('should publish SNS message', async () => {
            const products = [{ name: 'Product1', price: 10, count: 5 }];

            const publishMock = jest.fn().mockReturnValue({ promise: jest.fn() });
            mockSNS.prototype.publish = publishMock;

            await publishSnsMessage(products);

            expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({
                Message: JSON.stringify({ message: "Products created successfully", products }),
            }));
        });
    });
});