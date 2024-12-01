import { Stack, StackProps, Duration, aws_sqs as sqs, aws_ssm as ssm } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ProductsSQSStack extends Stack {
  readonly productsQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create an SQS queue with specific configurations:
    this.productsQueue = new sqs.Queue(this, 'catalogItemsQueue', {
      // Standard queue configurations
      queueName: 'CatalogItemsQueue', // Explicitly set the physical name
      deliveryDelay: Duration.seconds(0),
      receiveMessageWaitTime: Duration.seconds(20),
      visibilityTimeout: Duration.seconds(60),
      retentionPeriod: Duration.days(1),
      // setting dead letter queues for processing failures
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'DeadLetterQueue', {
          queueName: 'CatalogItemsDeadLetterQueue', // Explicitly set the physical name
          retentionPeriod: Duration.days(14) // Increase retention period from default of 4 days
        }),
        // how many times a message can be received before being sent to the dead letter queue
        maxReceiveCount: 5
      }
    });

    // Store the SQS Queue ARN in SSM Parameter Store
    new ssm.StringParameter(this, 'CatalogItemsQueueArnParameter', {
      parameterName: '/products-sqs-stack/catalogItemsQueueArn',
      stringValue: this.productsQueue.queueArn,
    });
  }
}