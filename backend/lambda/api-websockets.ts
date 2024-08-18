import { Tracer } from '@aws-lambda-powertools/tracer';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDbAdapter } from './adapter/dynamodb/dynamodb.adapter';
import { EvidentlyAdapter, FeatureFlag } from './adapter/evidently/evidently.adapter';
import { logger } from './utils/logger';
import { getEnvVarOrThrow } from './utils/utils';

const tracer = new Tracer({ serviceName: 'repo-tracker' });
const ddb = new DynamoDbAdapter(tracer, getEnvVarOrThrow('TABLE_NAME_CONNECTIONS'));
const evidently = new EvidentlyAdapter(tracer);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const {
    requestContext: { routeKey, connectionId },
  } = event;

  logger.info('Request received', { routeKey, connectionId });

  const errorFlag = await evidently.evaluate<string>(FeatureFlag.GenerateErrors);

  // This is to mock errors within websockets.
  if (errorFlag === 'websockets') {
    logger.error('Error flag is set for websockets');
    throw new Error(`Error flag is set for websockets`);
  }

  switch (routeKey) {
    case '$connect': {
      await ddb.saveConnection(connectionId!);
      logger.info('Connection saved', { connectionId });
      break;
    }
    case '$disconnect': {
      await ddb.deleteConnection(connectionId!);
      logger.info('Connection deleted', { connectionId });
      break;
    }
    case 'CLIENT_MESSAGE': {
      logger.info('Message received from the client', { connectionId, message: event.body });
    }
    case '$default':
      logger.error('Invalid route key', { routeKey });
      break;
  }
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  };
};
