import { AppEnvironmentConfig } from '@/config';
import { LambdaWithLogGroup } from '@/lib/constructs/lambda-with-log-group/lambda-with-log-group-construct';
import { FeatureFlaggingConstruct } from '@/lib/stacks/cloudwatch/constructs/feature-flagging/feature-flagging-construct';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import { LambdaRestApi, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';
interface Props {
  environment: AppEnvironmentConfig['name'];
  connectionTable: ITable;
  featureFlagConstruct: FeatureFlaggingConstruct;
}

export class WebsocketApiConstruct extends Construct {
  restApi: RestApi;
  lambdaRestApi: LambdaRestApi;
  webSocketApi: WebSocketApi;
  websocketStage: WebSocketStage;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    // Access logging is not supported yet in CDK: https://github.com/aws/aws-cdk/issues/11100 😢
    const { environment, connectionTable, featureFlagConstruct } = props;

    const websocketHandler = new LambdaWithLogGroup(this, 'ws-handler', {
      description: 'The Lambda Handler that handles connect, disconnect, and message routes on the WSS API',
      entry: path.join(__dirname, '../../../../../../../backend/lambda/api-websockets.ts'),
      timeout: Duration.seconds(30),
      environment: {
        TABLE_NAME_CONNECTIONS: connectionTable.tableName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        EVIDENTLY_PROJECT_ARN: featureFlagConstruct.evidentlyProject.attrArn,
      },
    });

    this.webSocketApi = new WebSocketApi(this, 'WebsocketStage', {
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration('ConnectIntegration', websocketHandler),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration('DisconnectIntegration', websocketHandler),
      },
      defaultRouteOptions: {
        integration: new WebSocketLambdaIntegration('DefaultIntegration', websocketHandler),
      },
    });

    this.websocketStage = new WebSocketStage(this, 'WebsocketStageGithub', {
      webSocketApi: this.webSocketApi,
      stageName: environment,
      autoDeploy: true,
    });

    websocketHandler.addEnvironment('WEBSOCKET_URL', this.websocketStage.url);

    websocketHandler.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'evidently:ListProjects',
          'evidently:EvaluateFeature',
          'evidently:UpdateFeature',
          'evidently:GetFeature',
        ],
        resources: ['*'],
      })
    );

    connectionTable.grantReadWriteData(websocketHandler);
    this.webSocketApi.grantManageConnections(websocketHandler);

    new CfnOutput(this, 'WssApiUrl', {
      exportName: `wss-api-url`,
      value: this.websocketStage.url,
    });
  }
}
