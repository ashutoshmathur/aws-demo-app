import { APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../getProductsList';

describe('getProductsList Lambda Function', () => {
    it('should return status code 200 and a list of products', async () => {
        const event = { /* mock event */ };
        const context = { /* mock context */ };
        const response = await handler(event as any, context as any, () => {}) as APIGatewayProxyResult;

        expect(response.statusCode).toBe(200);
        expect(response.body).toBeDefined();
        const body = JSON.parse(response.body as string);
        expect(Array.isArray(body)).toBeTruthy();
        expect(body.length).toBeGreaterThan(0); // Assuming there is at least one product in mock
    });
});