import { Tracer } from '@aws-lambda-powertools/tracer';
import {
  EvaluateFeatureCommand,
  EvidentlyClient,
  ListExperimentsCommand,
  ListExperimentsCommandOutput,
  ListLaunchesCommand,
  ListLaunchesCommandOutput,
  PutProjectEventsCommand,
  StopExperimentCommand,
  UpdateFeatureCommand,
} from '@aws-sdk/client-evidently';
import { LazyJsonString } from '@aws-sdk/smithy-client';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { createHash, randomUUID } from 'crypto';
import UAParser from 'ua-parser-js';
import { logger } from '../../utils/logger';
import { getEnvVarOrThrow } from '../../utils/utils';

export enum FeatureFlag {
  ShowStars = 'show_stars',
  ShowSearchbar = 'show_searchbar',
  GenerateTraffic = 'generate_traffic',
  GenerateErrors = 'generate_errors',
}

type Variations = (string | boolean)[];

export const FeatureToggle: Record<FeatureFlag, Variations> = {
  [FeatureFlag.ShowStars]: ['true', 'false'],
  [FeatureFlag.ShowSearchbar]: ['true', 'false'],
  [FeatureFlag.GenerateTraffic]: ['none', 'low', 'medium', 'high'],
  [FeatureFlag.GenerateErrors]: ['none', 'github-api', 'websockets', 'rest-api'],
};

export enum EvidentlyMetric {
  FavoritesAddedInSession = 'FavoritesAddedInSession',
  UseSearchBarRemote = 'UseSearchBarRemote',
  AddFavorite = 'AddFavorite',
}

export interface Experiment {
  name: string;
  description: string;
  status: string;
}

export interface Launch {
  name: string;
  description: string;
  status: string;
}

export const GetFeatureDetails = (flagName: FeatureFlag) => {
  logger.info('GetFeatureDetails', { flagName });
  return {
    name: flagName,
    variations: FeatureToggle[flagName],
  };
};

export class EvidentlyAdapter {
  private readonly region = process.env.AWS_REGION;
  private client: EvidentlyClient;

  constructor(tracer: Tracer) {
    this.client = tracer.captureAWSv3Client(new EvidentlyClient({ region: this.region }));
  }

  /**
   * Track an event in Evidently.
   * These events can be later used to track the performance of a launch or an experiment.
   * In theory, for tracking launch / experiments performance, we can also use RUM metrics.
   * As mentioned in the book, this didn't work well for us due to CloudWatch console issues.
   */
  async trackEvent(
    event: APIGatewayProxyEvent,
    eventId: EvidentlyMetric,
    eventDetails: Record<string, string | number> = {}
  ) {
    const command = new PutProjectEventsCommand({
      project: getEnvVarOrThrow('EVIDENTLY_PROJECT_ARN'),
      events: [
        {
          timestamp: new Date(),
          type: 'aws.evidently.custom',
          data: JSON.stringify({
            userDetails: { userId: this.getEntityId(event) },
            details: { eventId, ...eventDetails },
          }),
        },
      ],
    });
    await this.client.send(command);
  }

  async toggle(feature: FeatureFlag, variation: string) {
    logger.info(`Updating feature ${feature} to ${variation}`, { feature, variation });
    const command = new UpdateFeatureCommand({
      project: getEnvVarOrThrow('EVIDENTLY_PROJECT_ARN'),
      feature,
      defaultVariation: variation,
    });
    await this.client.send(command);
  }

  /**
   * Evaluate a feature flag for a given entity.
   */
  async evaluate<T extends boolean | string | number>(
    featureId: FeatureFlag,
    event?: APIGatewayProxyEvent
  ): Promise<T> {
    const entityId = this.getEntityId(event);
    const deviceDetails = this.getDeviceDetails(event);
    const { browser, os, deviceType } = deviceDetails;
    logger.info(`Evaluating feature '${featureId}' for entity '${entityId}' on '${browser}/${os}/${deviceType}`, {
      featureId,
      entityId,
      ...deviceDetails,
    });
    const command = new EvaluateFeatureCommand({
      project: getEnvVarOrThrow('EVIDENTLY_PROJECT_ARN'),
      feature: GetFeatureDetails(featureId).name,
      entityId: entityId,
      evaluationContext: LazyJsonString.fromObject({
        ...deviceDetails,
        ipAddress: this.getIpAddress(event),
      }),
    });
    const response = await this.client.send(command);

    if (typeof response.value === 'object' && response.value !== null) {
      if ('boolValue' in response.value && typeof response.value.boolValue === 'boolean') {
        return response.value.boolValue as T;
      } else if ('stringValue' in response.value && typeof response.value.stringValue === 'string') {
        return response.value.stringValue as T;
      } else if ('longValue' in response.value && typeof response.value.longValue === 'number') {
        return response.value.longValue as T;
      } else if ('doubleValue' in response.value && typeof response.value.doubleValue === 'number') {
        return response.value.doubleValue as T;
      }
    }

    throw new Error('Feature value type is not supported or feature is not found.');
  }

  async listLaunches() {
    const command = new ListLaunchesCommand({
      project: getEnvVarOrThrow('EVIDENTLY_PROJECT_ARN'),
    });
    const launches: ListLaunchesCommandOutput = await this.client.send(command);
    return this.toLaunchResponse(launches);
  }

  async listExperiments() {
    const command = new ListExperimentsCommand({
      project: getEnvVarOrThrow('EVIDENTLY_PROJECT_ARN'),
    });
    const experiments: ListExperimentsCommandOutput = await this.client.send(command);
    return this.toExperimentsResponse(experiments);
  }

  async stopAllExperiments() {
    logger.info('Stopping all running experiments');
    const listExperimentsCommand = new ListExperimentsCommand({
      project: getEnvVarOrThrow('EVIDENTLY_PROJECT_ARN'),
    });
    const { experiments = [] }: ListExperimentsCommandOutput = await this.client.send(listExperimentsCommand);

    for (const { name: experiment, status } of experiments) {
      if (status === 'RUNNING') {
        try {
          const stopCommand = new StopExperimentCommand({
            project: getEnvVarOrThrow('EVIDENTLY_PROJECT_ARN'),
            experiment,
          });
          await this.client.send(stopCommand);
        } catch (err) {
          logger.error(`Failed to stop experiment '${experiment}'`, { experiment, err });
        }
        logger.info(`Stopped experiment '${experiment}'`, { experiment });
      }
    }
  }

  /**
   *
   * This ID will be the unique identifier to Evidently.
   * It will decided to which group the user will be mapped to in a launch plan.
   *
   * This is necessary to ensure that the same user will always see the same variation
   * as we do not have a logged-in state, we need to use a unique identifier
   * a combination of User-Agent and X-Forwarded-For (= IP address) should be unique enough.
   */
  private getEntityId(event: APIGatewayProxyEvent | undefined) {
    const userAgent: string | undefined = event?.headers['User-Agent'] ?? randomUUID();
    const forwardedFor: string | undefined = event?.headers['X-Forwarded-For'] ?? randomUUID();
    const entityId = createHash('sha256').update(`${userAgent}-${forwardedFor}`).digest('hex');
    logger.info(`Entity ID calculated: ${entityId}`, { userAgent, forwardedFor, entityId });
    return entityId;
  }

  private toExperimentsResponse(response: ListExperimentsCommandOutput): Experiment[] {
    return (
      response.experiments?.map((experiment) => ({
        name: experiment.name ?? '',
        description: experiment.description ?? '',
        status: experiment.status ?? '',
      })) ?? []
    );
  }

  private toLaunchResponse(response: ListLaunchesCommandOutput): Launch[] {
    return (
      response.launches?.map((launch) => ({
        name: launch.name ?? '',
        description: launch.description ?? '',
        status: launch.status ?? '',
      })) ?? []
    );
  }

  /**
   * Will return the device details based on the User-Agent header.
   *
   * Example:
   * {
   *   "browser": "Safari",
   *   "engine": "WebKit",
   *   "os": "Mac OS",
   *   "deviceVendor": "Apple",
   *   "deviceModel": "Macintosh"
   * }
   */
  private getDeviceDetails(event: APIGatewayProxyEvent | undefined): Record<string, string | undefined> {
    const parser = new UAParser(event?.headers?.['User-Agent'] ?? '');
    const result = parser.getResult();
    const userAgent = result.ua;
    const browser = result.browser.name;
    const engine = result.engine.name;
    const os = result.os.name;
    const deviceVendor = result.device.vendor;
    const deviceModel = result.device.model;
    const deviceType = result.device.type;
    return { ua: userAgent, browser, engine, os, deviceVendor, deviceModel, deviceType };
  }

  private getIpAddress(event: APIGatewayProxyEvent | undefined): string {
    return event?.headers?.['X-Forwarded-For'] ?? 'Unknown';
  }
}
