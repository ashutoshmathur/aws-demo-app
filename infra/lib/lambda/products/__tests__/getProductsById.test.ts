import { handler } from '../getProductById';
import { APIGatewayProxyResult } from 'aws-lambda';

describe('getProductsById Lambda Function', () => {
    it('should return status code 200 and the product when the product exists', async () => {
        const event = { pathParameters: { product_id: "1" } };
        const context = {};
        const response = await handler(event as any) as APIGatewayProxyResult;

        expect(response.statusCode).toBe(200);
        expect(response.body).toBeDefined();
        const body = JSON.parse(response.body as string);
        expect(body).toEqual({ id: "1", title: "Product 1", description: "Product 1 description", price: 100 });
    });

    it('should return status code 404 when the product does not exist', async () => {
        const event = { pathParameters: { product_id: "999" } };
        const context = {};
        const response = await handler(event as any) as APIGatewayProxyResult;

        expect(response.statusCode).toBe(404);
        expect(response.body).toBeDefined();
        const body = JSON.parse(response.body as string);
        expect(body.error).toEqual('Product not found');
    });
});