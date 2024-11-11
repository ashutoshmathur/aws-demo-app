import { Stack, StackProps, Duration, aws_sqs as sqs } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ProductsSQSStack extends Stack {
  readonly productsQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create an SQS queue with specific configurations:
    this.productsQueue = new sqs.Queue(this, 'catalogItemsQueue', {
      // Standard queue configurations
      deliveryDelay: Duration.seconds(0),
      receiveMessageWaitTime: Duration.seconds(20),
      visibilityTimeout: Duration.seconds(60),
      retentionPeriod: Duration.days(1),
      // setting dead letter queues for processing failures
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'DeadLetterQueue', {
          retentionPeriod: Duration.days(14) // Increase retention period from default of 4 days
        }),
        // how many times a message can be received before being sent to the dead letter queue
        maxReceiveCount: 5
      }
    });
  }
}