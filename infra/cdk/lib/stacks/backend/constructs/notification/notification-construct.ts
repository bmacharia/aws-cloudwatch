import { AppEnvironmentConfig } from '@/config';
import { LambdaWithLogGroup } from '@/lib/constructs/lambda-with-log-group/lambda-with-log-group-construct';
import { Duration, SecretValue, aws_events_targets } from 'aws-cdk-lib';
import { WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Authorization, Connection, Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { DefinitionBody, StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import * as path from 'path';

interface Props {
  environment: AppEnvironmentConfig['name'];
  repositoryTable: ITable;
  connectionTable: ITable;
  webSocketApi: WebSocketApi;
  websocketStage: WebSocketStage;
  websocketUrl: string;
}

export class NotificationConstruct extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { connectionTable, repositoryTable, websocketStage, webSocketApi, websocketUrl } = props;

    const connection = new Connection(this, 'MockConnection', {
      authorization: Authorization.apiKey('mock-api-key', new SecretValue('mock-secret')),
    });

    const notificationLambda = new LambdaWithLogGroup(this, 'NotificationLambda', {
      entry: path.join(__dirname, '../../../../../../../backend/lambda/notification-cron.ts'),
    });

    const websocketUrlWithoutProtocol = websocketUrl.split('://')[1];
    const websocketUrlWithoutPath = websocketUrlWithoutProtocol.split('/')[0];

    const stateDefinition = {
      Comment: 'A step function to get a diff of all repositories and send notifications',
      StartAt: 'Get All Repositories',
      States: {
        'Get All Repositories': {
          Type: 'Task',
          Parameters: {
            TableName: repositoryTable.tableName,
          },
          Resource: 'arn:aws:states:::aws-sdk:dynamodb:scan',
          Next: 'Map over all repositories',
          ResultSelector: {
            'Items.$': '$.Items[*]',
          },
        },
        'Map over all repositories': {
          Type: 'Map',
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'INLINE',
            },
            StartAt: 'Get Repo Data From GitHub API',
            States: {
              'Get Repo Data From GitHub API': {
                Type: 'Task',
                Resource: 'arn:aws:states:::http:invoke',
                Parameters: {
                  Method: 'GET',
                  Authentication: {
                    ConnectionArn: connection.connectionArn,
                  },
                  'ApiEndpoint.$': "States.Format('https://api.github.com/repos/{}', $.originalRepo.full_name.S)",
                },
                Retry: [
                  {
                    ErrorEquals: ['States.ALL'],
                    BackoffRate: 2,
                    IntervalSeconds: 1,
                    MaxAttempts: 3,
                    JitterStrategy: 'FULL',
                  },
                ],
                Next: 'Diff',
                ResultSelector: {
                  'full_name.$': '$.ResponseBody.full_name',
                  'description.$': '$.ResponseBody.description',
                  'forks.$': '$.ResponseBody.forks',
                  'language.$': '$.ResponseBody.language',
                  'last_updated.$': '$.ResponseBody.updated_at',
                  'stars.$': '$.ResponseBody.stargazers_count',
                  'subscribers_count.$': '$.ResponseBody.subscribers_count',
                  'created_at.$': '$.ResponseBody.created_at',
                  'open_issues_count.$': '$.ResponseBody.open_issues_count',
                  'avatar_url.$': '$.ResponseBody.owner.avatar_url',
                },
                ResultPath: '$.currentRepo',
              },
              Diff: {
                Type: 'Task',
                Resource: 'arn:aws:states:::lambda:invoke',
                OutputPath: '$.Payload',
                Parameters: {
                  'Payload.$': '$',
                  FunctionName: notificationLambda.functionName,
                },
                Retry: [
                  {
                    ErrorEquals: [
                      'Lambda.ServiceException',
                      'Lambda.AWSLambdaException',
                      'Lambda.SdkClientException',
                      'Lambda.TooManyRequestsException',
                    ],
                    IntervalSeconds: 1,
                    MaxAttempts: 3,
                    BackoffRate: 2,
                  },
                ],
                Next: 'Difference?',
              },
              'Difference?': {
                Type: 'Choice',
                Choices: [
                  {
                    Variable: '$.hasChanged',
                    BooleanEquals: true,
                    Next: 'DynamoDB PutItem',
                    Comment: 'Repo has Changed',
                  },
                  {
                    Variable: '$.hasChanged',
                    BooleanEquals: false,
                    Next: 'Success',
                  },
                ],
              },
              'DynamoDB PutItem': {
                Type: 'Task',
                Resource: 'arn:aws:states:::dynamodb:putItem',
                Parameters: {
                  TableName: repositoryTable.tableName,
                  'Item.$': '$.repo',
                },
                Next: 'Get WebSocket Connections',
                ResultPath: null,
              },
              'Get WebSocket Connections': {
                Type: 'Task',
                Parameters: {
                  TableName: connectionTable.tableName,
                },
                Resource: 'arn:aws:states:::aws-sdk:dynamodb:scan',
                Next: 'Broadcast WebSocket',
                ResultPath: '$.connections',
              },
              'Broadcast WebSocket': {
                Type: 'Map',
                ItemProcessor: {
                  ProcessorConfig: {
                    Mode: 'INLINE',
                  },
                  StartAt: 'Send WebSocket Message',
                  States: {
                    'Send WebSocket Message': {
                      Type: 'Task',
                      Resource: 'arn:aws:states:::apigateway:invoke',
                      Parameters: {
                        ApiEndpoint: websocketUrlWithoutPath,
                        Method: 'POST',
                        Headers: {
                          'Content-Type': ['application/json'],
                        },
                        Stage: websocketStage.stageName,
                        'Path.$': "States.Format('/@connections/{}', $.connectionItem.connection_id.S)",
                        RequestBody: {
                          'repoName.$': '$.repoName',
                        },
                        AuthType: 'IAM_ROLE',
                      },
                      End: true,
                    },
                  },
                },
                ItemsPath: '$.connections.Items',
                ItemSelector: {
                  'connectionItem.$': '$$.Map.Item.Value',
                  'repoName.$': '$.repo.full_name.S',
                },
                End: true,
              },
              Success: {
                Type: 'Succeed',
              },
            },
          },
          End: true,
          ItemsPath: '$.Items',
          ItemSelector: {
            'originalRepo.$': '$$.Map.Item.Value',
          },
        },
      },
    };

    const stateMachine = new StateMachine(this, 'NotificationStateMachine', {
      definitionBody: DefinitionBody.fromString(JSON.stringify(stateDefinition)),
      // Activate X-Ray
      tracingEnabled: true,
    });

    // Create a rule that triggers the state machine every 6 hours
    new Rule(this, 'Rule', {
      schedule: Schedule.rate(Duration.hours(6)),
      targets: [new aws_events_targets.SfnStateMachine(stateMachine)],
    });

    notificationLambda.grantInvoke(stateMachine);
    repositoryTable.grantReadWriteData(stateMachine);
    connectionTable.grantReadData(stateMachine);
    webSocketApi.grantManageConnections(stateMachine);

    // -- IAM --
    // give state machine permission to states:InvokeHTTPEndpoint
    stateMachine.addToRolePolicy(
      new PolicyStatement({
        actions: ['states:InvokeHTTPEndpoint', 'states:DescribeExecution'],
        resources: ['*'],
      })
    );

    stateMachine.addToRolePolicy(
      new PolicyStatement({
        actions: ['events:RetrieveConnectionCredentials'],
        resources: [connection.connectionArn],
      })
    );

    stateMachine.addToRolePolicy(
      new PolicyStatement({
        actions: ['secretsmanager:DescribeSecret', 'secretsmanager:GetSecretValue'],
        resources: [connection.connectionSecretArn],
      })
    );
  }
}
