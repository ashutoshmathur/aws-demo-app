import { S3Event } from 'aws-lambda';
import { S3, SQS } from 'aws-sdk';
import * as csv from 'csv-parser';

const s3 = new S3({ region: process.env.AWS_REGION });
const sqs = new SQS({ region: process.env.AWS_REGION });
const queueUrl = process.env.QUEUE_URL || '';

export async function handler(event: S3Event): Promise<void> {
  console.log('[importFileParser] Event:', JSON.stringify(event));

  for (const record of event.Records) {
    const { bucket: { name: bucket }, object: { key } } = record.s3;
    
    if (!key.endsWith('.csv')) {
      console.error('Unsupported file extension. Only .csv files are supported.');
      continue;
    }

    console.log(`Processing CSV file: ${key} from bucket: ${bucket}`);
    await processCsvFile(bucket, key);
  }
}

async function processCsvFile(bucket: string, key: string) {
  try {
    const s3Stream = s3.getObject({ Bucket: bucket, Key: key }).createReadStream();
    const parsedData: Record<string, string>[] = [];

    await new Promise<void>((resolve, reject) => {
      s3Stream
        .pipe(csv())
        .on('data', (data: Record<string, string>) => parsedData.push(data))
        .on('error', reject)
        .on('end', resolve);
    });

    console.log('CSV Parsing Complete. Records:', parsedData.length);

    await sendMessagesInBatch(parsedData);
    await moveProcessedFile(bucket, key);

  } catch (error) {
    console.error('[processCsvFile] Error:', error);
  }
}

async function sendMessagesInBatch(messages: Record<string, string>[]) {
  const batchSize = 10;
  const messageBatches = messages.reduce((batches, message, index) => {
    const batchIndex = Math.floor(index / batchSize);
    batches[batchIndex] = batches[batchIndex] || [];
    batches[batchIndex].push({
      Id: `${Date.now()}-${index}`,
      MessageBody: JSON.stringify(message),
    });
    return batches;
  }, [] as { Id: string; MessageBody: string; }[][]);

  const promises = messageBatches.map(batch => 
    sqs.sendMessageBatch({ QueueUrl: queueUrl, Entries: batch }).promise()
  );

  await Promise.all(promises);
}

async function moveProcessedFile(bucket: string, key: string) {
  const newKey = key.replace('uploaded/', 'parsed/');
  
  await s3.copyObject({
    Bucket: bucket,
    CopySource: `${bucket}/${key}`,
    Key: newKey,
  }).promise();

  await s3.deleteObject({
    Bucket: bucket,
    Key: key,
  }).promise();

  console.log(`File moved from ${key} to ${newKey}`);
}