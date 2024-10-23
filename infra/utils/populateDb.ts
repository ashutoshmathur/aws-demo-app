import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const dynamoDb = new AWS.DynamoDB.DocumentClient({
    region: 'us-east-1',
});

async function populateData() {
  const productId = uuidv4();
  
  const productData = {
    TableName: 'products',
    Item: {
      id: productId, // uuid for example
      title: 'Sample Product',
      description: 'This is a sample product',
      price: 100
    }
  };

  await dynamoDb.put(productData).promise();

  const stockData = {
    TableName: 'stock',
    Item: {
      product_id: productId, // uuid must match
      count: 10
    }
  };

  await dynamoDb.put(stockData).promise();
}

populateData().then(() => console.log('Data populated successfully!')).catch((error) => console.log(error));