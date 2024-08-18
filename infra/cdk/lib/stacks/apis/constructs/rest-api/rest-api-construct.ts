import { AppEnvironmentConfig } from '@/config';
import { MonitoringAlarm } from '@/lib/aspects/monitoring-alarm';
import { LambdaWithLogGroup } from '@/lib/constructs/lambda-with-log-group/lambda-with-log-group-construct';
import { FeatureFlaggingConstruct } from '@/lib/stacks/cloudwatch/constructs/feature-flagging/feature-flagging-construct';
import { CfnOutput } from 'aws-cdk-lib';
import { AccessLogFormat, LambdaRestApi, LogGroupLogDestination, MethodLoggingLevel } from 'aws-cdk-lib/aws-apigateway';
import { EndpointType } from 'aws-cdk-lib/aws-apigatewayv2';
import { Unit } from 'aws-cdk-lib/aws-cloudwatch';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { DataIdentifier, DataProtectionPolicy, FilterPattern, LogGroup, MetricFilter } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

interface Props {
  environment: AppEnvironmentConfig['name'];
  featureFlagConstruct: FeatureFlaggingConstruct;
  connectionTable: ITable;
  repositoryTable: ITable;
}

export class RestApiConstruct extends Construct {
  lambdaRestApi: LambdaRestApi;
  lambda: LambdaWithLogGroup;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { environment, featureFlagConstruct, repositoryTable, connectionTable } = props;

    this.lambda = new LambdaWithLogGroup(this, 'RestApiHandler', {
      entry: path.join(__dirname, '../../../../../../../backend/lambda/api-rest.ts'),
      description: 'Lambda Handler to handle all REST API Requests',
      handler: 'handler',
      environment: {
        EVIDENTLY_PROJECT_ARN: featureFlagConstruct.evidentlyProject.attrArn,
        TABLE_NAME_REPOSITORIES: repositoryTable.tableName,
        TABLE_NAME_CONNECTIONS: connectionTable.tableName,
      },
      logGroupProps: {
        dataProtectionPolicy: new DataProtectionPolicy({ identifiers: [DataIdentifier.IPADDRESS] }),
      },
    });

    const stackName = scope.node.id;
    const constructName = id;

    this.lambdaRestApi = new LambdaRestApi(this, 'LambdaRestApi', {
      restApiName: `${environment}-${stackName}-${constructName}-RestApi`,
      description: 'Lambda backed REST API to handle repository and feature flag actions',
      handler: this.lambda,
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      },
      cloudWatchRole: true,
      deployOptions: {
        // Access Logs
        accessLogDestination: new LogGroupLogDestination(new LogGroup(this, 'RestApiAccessLogGroup')),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),

        // X-Ray Tracing
        tracingEnabled: true,

        // Log level of Execution Logs -> Log Group is automatically API-Gateway-Execution-Logs_<restApiId>/<stageName>
        loggingLevel: MethodLoggingLevel.INFO,
      },
      endpointTypes: [EndpointType.REGIONAL],
    });

    // This Log Group is automatically connected via the the Log Group Name
    new LogGroup(this, 'RestApiExecutionLogGroup', {
      logGroupName: `API-Gateway-Execution-Logs_${this.lambdaRestApi.restApiId}/prod`,
      dataProtectionPolicy: new DataProtectionPolicy({ identifiers: [DataIdentifier.IPADDRESS] }),
    });

    // Metric filter to create the InfoLogsCount Metrics
    new MetricFilter(this, 'InfoLogsCount', {
      logGroup: this.lambda.logGroup,
      filterPattern: FilterPattern.stringValue('$.logLevel', '=', 'INFO'),
      metricName: 'InfoLogsCount',
      metricNamespace: 'awsfundamentals/repotracker',
      metricValue: '1',
      unit: Unit.COUNT,
      dimensions: {
        ByFunctionName: '$.lambdaFunction.name',
      },
    });

    // CloudWatch Alarms
    new MonitoringAlarm(this, 'RestApi5XXErrorAlarm', {
      metric: this.lambdaRestApi.metricServerError(),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: '5XX Error Alarm',
    });

    // --- IAM ---
    this.lambda.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'evidently:ListProjects',
          'evidently:EvaluateFeature',
          'evidently:UpdateFeature',
          'evidently:GetFeature',
          'evidently:PutProjectEvents',
          'evidently:ListExperiments',
          'evidently:ListLaunches',
        ],
        resources: ['*'],
      })
    );

    repositoryTable.grantReadWriteData(this.lambda);

    new CfnOutput(this, 'RestApiUrl', {
      exportName: `rest-api-url`,
      value: this.lambdaRestApi.url.replace(/\/$/, ''),
    });
  }
}
