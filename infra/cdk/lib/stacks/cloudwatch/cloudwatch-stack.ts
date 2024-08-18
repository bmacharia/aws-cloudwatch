import { AppEnvironmentConfig } from '@/config';
import { AlerterConstruct } from '@/lib/stacks/cloudwatch/constructs/alerter-construct/alerter-construct';
import { FeatureFlaggingConstruct } from '@/lib/stacks/cloudwatch/constructs/feature-flagging/feature-flagging-construct';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface CloudWatchStackProps extends Omit<StackProps, 'env'>, AppEnvironmentConfig {}

export class CloudWatchStack extends Stack {
  featureFlag: FeatureFlaggingConstruct;
  alerter: AlerterConstruct;
  constructor(scope: Construct, id: string, props: CloudWatchStackProps) {
    super(scope, id, props);

    this.featureFlag = new FeatureFlaggingConstruct(this, 'FeatureFlaggingConstruct', {
      environment: props.name,
    });

    this.alerter = new AlerterConstruct(this, 'AlerterConstruct', {
      ...props,
      featureFlagConstruct: this.featureFlag,
    });
  }
}
