import { MonitoringAlarmAction } from '@/lib/aspects/monitoring-alarm';
import { ApiStack } from '@/lib/stacks/apis/api-stack';
import { BackendStack } from '@/lib/stacks/backend/backend-stack';
import { CloudWatchStack } from '@/lib/stacks/cloudwatch/cloudwatch-stack';
import { FrontendHostingStack } from '@/lib/stacks/frontend-hosting/frontend-hosting-stack';
import { MonitoringStack } from '@/lib/stacks/monitoring/monitoring-stack';
import { TablesStack } from '@/lib/stacks/tables/tables-stack';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppEnvironmentConfig } from '../../config';

export class Stage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: AppEnvironmentConfig) {
    super(scope, id, props);

    const tables = new TablesStack(this, 'TablesStack', props);

    const cloudwatchStack = new CloudWatchStack(this, 'CloudWatchStack', props);

    const apis = new ApiStack(this, 'ApiStack', {
      ...props,
      connectionTable: tables.connectionTable,
      featureFlagConstruct: cloudwatchStack.featureFlag,
      repositoryTable: tables.repositoryTable,
    });

    new BackendStack(this, 'BackendStack', {
      ...props,
      connectionTable: tables.connectionTable,
      repositoryTable: tables.repositoryTable,
      websocketApiConstruct: apis.websocketApi,
      featureFlaggingConstruct: cloudwatchStack.featureFlag,
      restApiUrl: apis.restApi.lambdaRestApi.url,
    });

    const frontendHosting = new FrontendHostingStack(this, 'FrontendHostingStack', {
      ...props,
      restApiUrl: apis.restApi.lambdaRestApi.url,
    });

    new MonitoringStack(this, 'MonitoringStack', {
      ...props,
      frontendUrl: frontendHosting.distribution.distributionDomainName,
      alerter: cloudwatchStack.alerter,
      restApi: apis.restApi,
    });

    cdk.Aspects.of(this).add(new MonitoringAlarmAction(props.name));
  }
}
