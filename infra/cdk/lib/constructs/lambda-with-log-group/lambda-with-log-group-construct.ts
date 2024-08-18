import { MonitoringAlarm } from '@/lib/aspects/monitoring-alarm';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Architecture, LayerVersion, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, LogGroupProps, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { merge } from 'lodash';

interface LambdaWithLogGroupProps extends NodejsFunctionProps {
  entry?: NodejsFunctionProps['entry'];
  runtime?: NodejsFunctionProps['runtime'];
  memorySize?: NodejsFunctionProps['memorySize'];
  timeout?: NodejsFunctionProps['timeout'];
  architecture?: NodejsFunctionProps['architecture'];
  logGroupProps?: Omit<LogGroupProps, 'logGroupName'>;
  addInsightsLayer?: boolean;
}

const nodejsFunctionDefaultProps: LambdaWithLogGroupProps = {
  handler: 'handler',
  runtime: Runtime.NODEJS_18_X,
  memorySize: 256,
  timeout: Duration.seconds(10),
  architecture: Architecture.ARM_64,
  tracing: Tracing.ACTIVE,
  bundling: {
    externalModules: [],
  },
  addInsightsLayer: true,
};

const logGroupDefaultProps: Partial<LogGroupProps> = {
  retention: RetentionDays.ONE_WEEK,
  removalPolicy: RemovalPolicy.DESTROY,
};

export class LambdaWithLogGroup extends NodejsFunction {
  constructor(scope: Construct, id: string, props: LambdaWithLogGroupProps) {
    const mergedProps = merge({}, nodejsFunctionDefaultProps, props);
    super(scope, id, mergedProps);

    const { logGroupProps, addInsightsLayer } = mergedProps;

    // This layer is required to activate Lambda Insights
    if (addInsightsLayer) {
      this.addLayers(
        LayerVersion.fromLayerVersionArn(
          this,
          'LambdaInsightsLayer',
          'arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension-Arm64:11'
        )
      );
    }

    new MonitoringAlarm(this, 'Errors', {
      alarmDescription: 'At least 5 error within a 5 minute period',
      metric: this.metricErrors({
        period: Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    const logGroupPropsMerged = merge(
      {},
      {
        logGroupName: '/aws/lambda/' + this.functionName,
        ...logGroupDefaultProps,
      },
      logGroupProps
    );

    new LogGroup(this, `${id}LogGroup`, logGroupPropsMerged);

    // Add Managed Policy to activate Lambda Insights
    this.role?.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy'));
  }
}
