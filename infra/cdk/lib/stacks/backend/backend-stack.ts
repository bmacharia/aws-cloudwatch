import { AppEnvironmentConfig } from '@/config';

import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';

import { NotificationConstruct } from '@/lib/stacks/backend/constructs/notification/notification-construct';
import { WebsocketApiConstruct } from '@/lib/stacks/apis/constructs/websocket-api/websocket-api-construct';
import { TrafficGeneratorConstruct } from '@/lib/stacks/backend/constructs/traffic-generator/traffic-generator-construct';
import { FeatureFlaggingConstruct } from '@/lib/stacks/cloudwatch/constructs/feature-flagging/feature-flagging-construct';

interface BackendStackProps extends Omit<StackProps, 'env'>, AppEnvironmentConfig {
  repositoryTable: ITable;
  connectionTable: ITable;
  websocketApiConstruct: WebsocketApiConstruct;
  featureFlaggingConstruct: FeatureFlaggingConstruct;
  restApiUrl: string;
}

export class BackendStack extends Stack {
  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const { websocketApiConstruct, restApiUrl, featureFlaggingConstruct } = props;

    const { webSocketApi, websocketStage } = websocketApiConstruct;

    new NotificationConstruct(this, 'NotificationConstructs', {
      environment: props.name,
      repositoryTable: props.repositoryTable,
      connectionTable: props.connectionTable,
      webSocketApi: webSocketApi,
      websocketStage: websocketStage,
      websocketUrl: websocketStage.url,
    });

    new TrafficGeneratorConstruct(this, 'TrafficGeneratorConstruct', {
      restApiUrl: restApiUrl,
      featureFlaggingConstruct,
    });
  }
}
