import { AppEnvironmentConfig } from '@/config';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { z } from 'zod';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { LambdaWithLogGroup } from '@/lib/constructs/lambda-with-log-group/lambda-with-log-group-construct';
import * as path from 'path';
import { Environment } from 'aws-cdk-lib';
import { FeatureFlaggingConstruct } from '../feature-flagging/feature-flagging-construct';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

interface AlerterConstructProps extends AppEnvironmentConfig {
  featureFlagConstruct: FeatureFlaggingConstruct;
}

const emailSchema = z.string().email();

// This is used to connect the Alerter to the MonitoringAlarm

export class AlerterConstruct extends Construct {
  restApi: RestApi;
  alerterTopic: sns.Topic;
  constructor(scope: Construct, id: string, props: AlerterConstructProps) {
    super(scope, id);

    const { alarmEmails, discordWebhooks, name, featureFlagConstruct } = props;

    // Iterate through emails and validate them
    const validatedEmails = alarmEmails.map((email) => {
      const result = emailSchema.safeParse(email);

      if (!result.success) {
        throw new Error(`This is not a valid email: ${email}`);
      }
      return email;
    });

    // Create SNS Alerter Topic
    this.alerterTopic = new sns.Topic(this, 'AlerterTopic', {
      topicName: `${name}-AlarmTopic`,
    });

    // Add emails to the topic
    validatedEmails.forEach((email) => {
      this.alerterTopic.addSubscription(new snsSubscriptions.EmailSubscription(email));
    });

    // Create Lambda for discord notifier
    const lambda = new LambdaWithLogGroup(this, 'AlerterLambda', {
      description: 'Lambda that is responsible for sending out Discord notifications',
      entry: path.join(__dirname, '../../../../../../../backend/lambda/sns-alarm.ts'),
      environment: {
        DISCORD_WEBHOOK_URL: discordWebhooks.awsNotifications || '',
        EVIDENTLY_PROJECT_ARN: featureFlagConstruct.evidentlyProject.attrArn,
      },
    });

    // Add Lambda to the topic
    this.alerterTopic.addSubscription(new snsSubscriptions.LambdaSubscription(lambda));

    // Give Lambda permissions to start and list evidently experiments
    lambda.addToRolePolicy(
      new PolicyStatement({
        actions: ['evidently:ListExperiments', 'evidently:StartExperiment'],
        resources: [featureFlagConstruct.evidentlyProject.attrArn],
      })
    );
  }

  static getTopicArn({ envName, env }: { envName: AppEnvironmentConfig['name']; env: Environment }) {
    return `arn:aws:sns:${env.region}:${env.account}:${envName}-AlarmTopic`;
  }
}
