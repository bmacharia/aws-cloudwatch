import { RestApiConstruct } from '@/lib/stacks/apis/constructs/rest-api/rest-api-construct';
import { AlerterConstruct } from '@/lib/stacks/cloudwatch/constructs/alerter-construct/alerter-construct';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { FilterPattern, LogGroup, MetricFilter } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface AnomalyDetectionProps {
  restApiConstruct: RestApiConstruct;
  alerter: AlerterConstruct;
}

export class AnomalyDetectionConstruct extends Construct {
  constructor(scope: Construct, id: string, props: AnomalyDetectionProps) {
    super(scope, id);

    const { restApiConstruct, alerter } = props;

    const logGroup = LogGroup.fromLogGroupName(this, 'LogGroup', restApiConstruct.lambda.logGroup.logGroupName);

    const stackName = scope.node.id;
    const constructName = id;

    const prefix = `${stackName}-${constructName}`;
    const namespace = 'awsfundamentals/repotracker';
    const metricName = 'RateLimitedCount';

    new MetricFilter(this, 'RateLimitedMetricFilter', {
      logGroup: logGroup,
      filterPattern: FilterPattern.literal('{ $.message = "Rate limited by Github" }'),
      metricName: metricName,
      metricNamespace: namespace,
      metricValue: '1',
    });

    new cloudwatch.CfnAlarm(this, 'AlarmRateLimit', {
      alarmName: `${prefix}-github-ratelimited-anomaly`,
      thresholdMetricId: 'ad1',
      alarmActions: [alerter.alerterTopic.topicArn],
      comparisonOperator: 'LessThanLowerOrGreaterThanUpperThreshold',
      treatMissingData: 'notBreaching',
      actionsEnabled: true,
      metrics: [
        {
          expression: 'ANOMALY_DETECTION_BAND(m1, 10)',
          id: 'ad1',
        },
        {
          metricStat: {
            period: 86400,
            metric: {
              metricName,
              namespace,
            },
            stat: 'Sum',
          },
          id: 'm1',
        },
      ],
      alarmDescription: 'Unusual number of Github API rate limit breaches',
      evaluationPeriods: 1,
      insufficientDataActions: [],
      okActions: [],
    });

    new cloudwatch.CfnAlarm(this, 'AlarmLambdaErrors', {
      alarmName: `${prefix}-invocations-anomaly`,
      thresholdMetricId: 'ad1',
      alarmActions: [alerter.alerterTopic.topicArn],
      comparisonOperator: 'LessThanLowerOrGreaterThanUpperThreshold',
      treatMissingData: 'notBreaching',
      actionsEnabled: true,
      metrics: [
        {
          expression: 'ANOMALY_DETECTION_BAND(m1, 10)',
          id: 'ad1',
        },
        {
          metricStat: {
            period: 86400,
            metric: {
              metricName: 'Invocations',
              namespace: 'AWS/Lambda',
            },
            stat: 'Sum',
          },
          id: 'm1',
        },
      ],
      alarmDescription: 'Lambda invocations are outside of the expected bounds',

      evaluationPeriods: 1,
      insufficientDataActions: [],
      okActions: [],
    });
  }
}
