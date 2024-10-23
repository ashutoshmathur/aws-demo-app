import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { products } from './data';

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
    const productId = event.pathParameters?.productId;
    
    if (!productId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Product ID is required' }),
            headers: {
                'Content-Type': 'application/json',
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
            }
        };
    }

    const product = products.find(p => p.id === productId);
    return {
        statusCode: product ? 200 : 404,
        body: JSON.stringify(product || { error: 'Product not found' }),
        headers: {
            'Content-Type': 'application/json'
        }
    };
};