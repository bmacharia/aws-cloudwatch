import { AppEnvironmentConfig } from '@/config';
import { RestApiConstruct } from '@/lib/stacks/apis/constructs/rest-api/rest-api-construct';
import { WebsocketApiConstruct } from '@/lib/stacks/apis/constructs/websocket-api/websocket-api-construct';
import { FeatureFlaggingConstruct } from '@/lib/stacks/cloudwatch/constructs/feature-flagging/feature-flagging-construct';

import { Stack, StackProps } from 'aws-cdk-lib';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

interface ApiStackProps extends Omit<StackProps, 'env'>, AppEnvironmentConfig {
  repositoryTable: ITable;
  connectionTable: ITable;
  featureFlagConstruct: FeatureFlaggingConstruct;
}

export class ApiStack extends Stack {
  restApi: RestApiConstruct;
  websocketApi: WebsocketApiConstruct;
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { featureFlagConstruct } = props;

    this.restApi = new RestApiConstruct(this, 'RestApiConstruct', {
      environment: props.name,
      featureFlagConstruct: featureFlagConstruct,
      repositoryTable: props.repositoryTable,
      connectionTable: props.connectionTable,
    });

    this.websocketApi = new WebsocketApiConstruct(this, 'WebsocketApiConstruct', {
      environment: props.name,
      connectionTable: props.connectionTable,
      featureFlagConstruct: featureFlagConstruct,
    });
  }
}
