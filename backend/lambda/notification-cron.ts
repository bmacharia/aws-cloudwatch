import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { RepositoryEntity } from './adapter/dynamodb/model/repository.entity';
import middy from '@middy/core';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { logger } from './utils/logger';

const tracer = new Tracer({ serviceName: 'notification-cron' });

type DynamoDBString = {
  S: string;
};

type DynamoDBNumber = {
  N: string;
};

type RepositoryDynamoDb = {
  forks: DynamoDBNumber;
  last_updated: DynamoDBString;
  full_name: DynamoDBString;
  description: DynamoDBString;
  language: DynamoDBString;
  stars: DynamoDBNumber;
  subscribers_count: DynamoDBNumber;
  created_at: DynamoDBString;
  open_issues_count: DynamoDBNumber;
  avatar_url: DynamoDBString;
};

type Repository = {
  forks: number;
  last_updated: string;
  full_name: string;
  description: string;
  language: string;
  stars: number;
  subscribers_count: number;
  created_at: string;
  open_issues_count: number;
  avatar_url: string;
};

type Event = {
  originalRepo: RepositoryDynamoDb;
  currentRepo: Repository;
};

type ReturnType = {
  hasChanged: boolean;
  repo: RepositoryDynamoDb | undefined;
};

// This Lambda checks if there is a diff with the current item. It then returns if there was a diff with the new data
export const lambdaHandler = async (event: Event): Promise<ReturnType> => {
  const { originalRepo, currentRepo } = event;

  const unmarshalledOriginalRepo: RepositoryEntity = {
    forks: Number(originalRepo.forks.N),
    last_updated: originalRepo.last_updated.S,
    full_name: originalRepo.full_name.S,
    description: originalRepo.description.S,
    language: originalRepo.language.S,
    stars: Number(originalRepo.stars.N),
    subscribers_count: Number(originalRepo.subscribers_count),
    created_at: originalRepo.created_at.S,
    open_issues_count: Number(originalRepo.open_issues_count.N),
    avatar_url: originalRepo.avatar_url?.S,
  };

  logger.info('Original Repository', { unmarshalledOriginalRepo });

  // Check if last_updated is different
  if (unmarshalledOriginalRepo.last_updated !== currentRepo.last_updated) {
    // marshall dynamodb item
    const marshalledRepo: RepositoryDynamoDb = {
      forks: {
        N: String(currentRepo.forks),
      },
      last_updated: {
        S: currentRepo.last_updated,
      },
      full_name: {
        S: currentRepo.full_name,
      },
      description: {
        S: currentRepo.description,
      },
      language: {
        S: currentRepo.language,
      },
      stars: {
        N: String(currentRepo.stars),
      },
      subscribers_count: {
        N: String(currentRepo.subscribers_count),
      },
      created_at: {
        S: currentRepo.created_at,
      },
      open_issues_count: {
        N: String(currentRepo.open_issues_count),
      },
      avatar_url: {
        S: currentRepo.avatar_url,
      },
    };

    return {
      hasChanged: true,
      repo: marshalledRepo,
    };
  }

  return {
    hasChanged: false,
    repo: undefined,
  };
};

export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer, { captureResponse: true }))
  // This adds the Lambda context to the logger
  .use(injectLambdaContext(logger, { logEvent: true }));
