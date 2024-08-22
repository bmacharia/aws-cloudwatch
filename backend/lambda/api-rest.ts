import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDbAdapter } from './adapter/dynamodb/dynamodb.adapter';
import {
  EvidentlyAdapter,
  EvidentlyMetric,
  FeatureFlag,
  GetFeatureDetails,
} from './adapter/evidently/evidently.adapter';
import { GithubAdapter } from './adapter/github/github.adapter';
import { logger } from './utils/logger';
import { HttpMethods, returnError, returnSuccess } from './utils/rest';
import { getEnvVarOrThrow } from './utils/utils';

const tracer = new Tracer({ serviceName: 'repo-tracker', captureHTTPsRequests: true });
const dynamodb = new DynamoDbAdapter(tracer, getEnvVarOrThrow('TABLE_NAME_REPOSITORIES'));
const github = new GithubAdapter(tracer);
const evidently = new EvidentlyAdapter(tracer);

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('## prep-data');
  tracer.setSegment(subsegment!);

  const { body, path } = event;
  const { httpMethod } = event.requestContext;
  let full_name: string | undefined;

  tracer.putAnnotation('httpMethod', httpMethod);
  tracer.putAnnotation('path', path!);
  if (full_name) {
    tracer.putAnnotation('repository', full_name!);
  }

  logger.info('Request details', { httpMethod, fullName: full_name, path });
  logger.appendKeys({
    correlationIds: {
      requestId: event.requestContext.requestId,
      httpMethod,
      path,
      fullName: full_name,
    },
  });

  subsegment?.close();
  tracer.setSegment(segment!);

  const subsegmentProcessRequest = segment?.addNewSubsegment('## process-request');
  tracer.setSegment(subsegmentProcessRequest!);

  if (path.startsWith('/repositories')) {
    const errorFlag = await evidently.evaluate<string>(FeatureFlag.GenerateErrors, event);
    if (errorFlag === 'rest-api') {
      logger.error('Error flag is set for rest-api');
      throw new Error(`Error flag is set for rest-api`);
    }
    switch (httpMethod) {
      case HttpMethods.OPTIONS:
        subsegmentProcessRequest?.close();
        tracer.setSegment(segment!);
        return returnSuccess(200, 'OK');
      case HttpMethods.GET: {
        const pathParts = path.split('/').filter(Boolean);
        if (pathParts.length === 2) {
          const subsegmentGetSingleRepo = subsegmentProcessRequest?.addNewSubsegment('## get-single-repository');
          tracer.setSegment(subsegmentGetSingleRepo!);

          full_name = decodeURIComponent(pathParts[1]);
          tracer.putAnnotation('repository', full_name);

          logger.info('Getting single repository from DynamoDB with full_name', { fullName: full_name });
          const repository = await dynamodb.getRepository(full_name);
          if (!repository) {
            logger.info('Repository not found in DynamoDB');
            subsegmentGetSingleRepo?.close();
            subsegmentProcessRequest?.close();
            tracer.setSegment(segment!);
            return returnError(404, `Repository ${full_name} not found.`);
          }

          subsegmentGetSingleRepo?.close();
          subsegmentProcessRequest?.close();
          tracer.setSegment(segment!);
          return returnSuccess(200, repository);
        }
        const subsegmentGetData = subsegmentProcessRequest?.addNewSubsegment('## get-repositories');
        tracer.setSegment(subsegmentGetData!);
        logger.info('Getting repositories from DynamoDB.');
        const repositories = await dynamodb.getRepositories();
        const showStars = await evidently.evaluate<boolean>(FeatureFlag.ShowStars, event);
        if (!showStars) {
          repositories.forEach((repository) => (repository.stars = -1));
        }
        subsegmentGetData?.close();
        subsegmentProcessRequest?.close();
        tracer.setSegment(segment!);
        return returnSuccess(200, repositories);
      }
      case HttpMethods.DELETE:
        const subsegmentDeleteData = subsegmentProcessRequest?.addNewSubsegment('## delete-repository');
        tracer.setSegment(subsegmentDeleteData!);
        const split = decodeURIComponent(path!).split('/');
        if (split.length <= 3) {
          return returnError(400, 'Missing full_name');
        }
        const toDelete = split.slice(-2).join('/');
        logger.info(`Removing ${toDelete} from DynamoDB.`, { toDelete });
        if (!toDelete) {
          subsegmentDeleteData?.close();
          subsegmentProcessRequest?.close();
          tracer.setSegment(segment!);
          return returnError(400, 'Missing full_name');
        }
        await dynamodb.removeRepository(toDelete);
        subsegmentDeleteData?.close();
        subsegmentProcessRequest?.close();
        tracer.setSegment(segment!);
        return returnSuccess(200, `${toDelete} removed from DynamoDB.`);
      case HttpMethods.POST:
        const subsegmentAddRepository = subsegmentProcessRequest?.addNewSubsegment('## add-repository');
        const toAdd = body ? JSON.parse(body!).full_name : undefined;
        if (!toAdd) {
          logger.error("Missing 'full_name' in body", { body });
          subsegmentAddRepository?.close();
          subsegmentProcessRequest?.close();
          tracer.setSegment(segment!);
          return returnError(400, 'Missing full_name');
        }

        const repository = await github.getRepository(toAdd);
        if (!repository) {
          logger.info('Repository not found');
          subsegmentAddRepository?.close();
          subsegmentProcessRequest?.close();
          tracer.setSegment(segment!);
          return returnError(404, `Repository ${toAdd} not found.`);
        }
        logger.info('Repository retrieved from Github', { repository });
        await Promise.all([
          dynamodb.addRepository(repository),
          evidently.trackEvent(event, EvidentlyMetric.AddFavorite, { full_name: toAdd, favoritesAdded: 1 }),
        ]);
        subsegmentAddRepository?.close();
        subsegmentProcessRequest?.close();
        tracer.setSegment(segment!);
        return returnSuccess(201, `${toAdd} added to DynamoDB.`);
      default:
        subsegmentProcessRequest?.close();
        tracer.setSegment(segment!);
        return returnError(400, `Unsupported method "${httpMethod}"`);
    }
  } else if (path.startsWith('/health')) {
    const errorFlag = await evidently.evaluate<string>(FeatureFlag.GenerateErrors, event);
    if (errorFlag === 'rest-api') {
      logger.error('Error flag is set for rest-api');
      throw new Error(`Error flag is set for rest-api`);
    }
    subsegmentProcessRequest?.close();
    tracer.setSegment(segment!);
    return returnSuccess(200, 'OK');
  } else if (path.startsWith('/metrics/favorites-added')) {
    const { favoritesAddedInSession } = body ? JSON.parse(body!) : { favoritesAddedInSession: undefined };
    // check that favoritesAddedInSession is not undefined (0 is fine)
    if (favoritesAddedInSession === undefined) {
      return returnError(400, 'Missing favoritesAdded');
    }
    await evidently.trackEvent(event, EvidentlyMetric.FavoritesAddedInSession, { favoritesAddedInSession });
    return returnSuccess(200);
  } else if (path.startsWith('/feature-toggles')) {
    switch (httpMethod) {
      case HttpMethods.GET: {
        const FeatureFlagStates = await Promise.all(
          Object.values(FeatureFlag).map(async (toggle) => {
            const value = await evidently.evaluate(toggle, event);
            return { value, ...GetFeatureDetails(toggle) };
          })
        );
        return returnSuccess(200, FeatureFlagStates);
      }
      case HttpMethods.POST: {
        const { name, value } = body ? JSON.parse(body!) : { name: undefined, value: undefined };
        if (!name || !value) {
          return returnError(400, 'Missing name or value');
        }
        await evidently.toggle(name, value);
        return returnSuccess(200, `${name} set to ${value}`);
      }
      default:
        return returnError(400, `Unsupported method "${httpMethod}"`);
    }
  } else if (path.startsWith('/experiments')) {
    const experiments = await evidently.listExperiments();
    return returnSuccess(200, experiments);
  } else if (path.startsWith('/launches')) {
    const launches = await evidently.listLaunches();
    return returnSuccess(200, launches);
  } else if (path.startsWith('/search')) {
    const query = event.queryStringParameters?.q;
    if (!query) {
      return returnError(400, 'Missing query parameter');
    }
    const decodedQuery = decodeURIComponent(query);
    const [repositories] = await Promise.all([
      github.searchRepositories(decodedQuery),
      evidently.trackEvent(event, EvidentlyMetric.UseSearchBarRemote, { query: decodedQuery, remoteSearchBarUsed: 1 }),
    ]);
    return returnSuccess(200, repositories);
  } else {
    return returnError(400, `Unsupported path "${path}"`);
  }
};

export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  // This adds the Lambda context to the logger and clears all correlation IDs at the end of the request
  .use(injectLambdaContext(logger, { logEvent: true}));
