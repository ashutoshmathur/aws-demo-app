import * as cdk from 'aws-cdk-lib';
import { aws_sns as sns, aws_sns_subscriptions as snsSubscriptions } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface ProductsSNSStackProps extends cdk.StackProps {
  productTopicName?: string;
  newProductsSubscriber?: string;
  lowStockProductsSubscriber?: string;
}

export class ProductsSNSStack extends cdk.Stack {
  readonly productTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: ProductsSNSStackProps = {}) {
    super(scope, id, props);

    const {
      productTopicName = 'createProductTopic',
      newProductsSubscriber = 'ashutoshmathurr@gmail.com',
      lowStockProductsSubscriber = 'ashutoshmathurr2@gmail.com',
    } = props;

    // Create SNS Topic
    this.productTopic = new sns.Topic(this, 'ProductTopic', {
      topicName: productTopicName,
    });

    // Add subscriptions to the topic with filter policies
    if (newProductsSubscriber) {
      this.addEmailSubscription(newProductsSubscriber, 'newProductsAdded');
    }

    if (lowStockProductsSubscriber) {
        this.addEmailSubscription(lowStockProductsSubscriber, 'lowStockProducts');
      }
  }

  private addEmailSubscription(email: string, filterKey: string) {
    this.productTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(email, {
        filterPolicy: {
          [filterKey]: sns.SubscriptionFilter.stringFilter({
            allowlist: ['true'],
          }),
        },
      })
    );
  }
}