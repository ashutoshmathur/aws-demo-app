import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { products } from './data';

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
   return {
       statusCode: 200,
       body: JSON.stringify(products),
       headers: {
           'Content-Type': 'application/json',
           "Access-Control-Allow-Origin": "*", // Required for CORS support to work
       }
   };
};