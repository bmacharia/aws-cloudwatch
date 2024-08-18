import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import axios, { AxiosInstance } from 'axios';
import { RepositoryEntity } from '../dynamodb/model/repository.entity';
import { EvidentlyAdapter, FeatureFlag } from '../evidently/evidently.adapter';
import { logger } from './../../utils/logger';
import { GithubRepository } from './model/github-repository';

const metrics = new Metrics({
  namespace: 'awsfundamentals/repotracker',
  serviceName: 'rest-api',
});

export class GithubAdapter {
  private client: AxiosInstance;
  private evidently: EvidentlyAdapter;

  constructor(tracer: Tracer) {
    this.evidently = new EvidentlyAdapter(tracer);
    const baseURL = 'https://api.github.com/';
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    this.client = axios.create({
      baseURL,
      headers,
      validateStatus: (status: number) => status < 300,
    });
  }

  searchRepositories = async (query: string): Promise<RepositoryEntity[]> => {
    await this.assetErrorGeneration();

    logger.info(`Searching for repositories on GitHub with query: ${query}`, { query });

    const response = await this.client
      .get<{ total_count: number; items: GithubRepository[] }>(`search/repositories`, { params: { q: query } })
      .catch((error) => {
        if (error.response.statusCode === 403) {
          logger.info(`Rate limited by Github`);
        }
        return {
          status: 200,
          data: {
            total_count: 0,
            items: [],
          },
        };
      });
    if (!response) {
      return [];
    }
    const { items, total_count } = response.data;
    logger.info(`Received ${total_count} repositories from Github`, {
      statusCode: response?.status,
      numberOfRepositories: total_count,
      query,
    });

    return items.map(this.toEntity);
  };

  getRepository = async (fullName: string): Promise<RepositoryEntity | undefined> => {
    await this.assetErrorGeneration();

    // If this repository is added we have a 3 second timeout to mock a slow response
    if (fullName === 'microsoft/vscode') {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    logger.info(`Getting repository ${fullName} from GitHub.`, { fullName });
    const response = await this.client.get<GithubRepository>(`repos/${fullName}`).catch((error) => {
      if (error.response.statusCode === 403) {
        logger.info(`Rate limited by Github`);
      } else if (error.response.status === 404) {
        logger.info(`Repository ${fullName} not found on GitHub.`);
      } else {
        logger.info(`Error getting repository ${fullName} from Github`, {
          statusCode: response?.status,
          error,
        });
      }
      return undefined;
    });
    if (!response) {
      return undefined;
    }
    logger.info(`Response received from Github`, {
      statusCode: response?.status,
    });

    metrics.addDimension('repository', fullName);
    metrics.addMetric('repository-added', MetricUnit.Count, 1);
    metrics.publishStoredMetrics();

    return this.toEntity(response.data);
  };

  private assetErrorGeneration = async () => {
    const errorFlag = await this.evidently.evaluate<string>(FeatureFlag.GenerateErrors);
    if (errorFlag === 'github-api') {
      logger.error('Error flag is set for github-api');
      throw new Error(`Error flag is set for github-api`);
    }
  };

  private toEntity = (response: GithubRepository): RepositoryEntity => ({
    full_name: response.full_name,
    description: response.description,
    forks: response.forks_count,
    stars: response.stargazers_count,
    language: response.language,
    last_updated: response.updated_at,
    subscribers_count: response.subscribers_count,
    created_at: response.created_at,
    open_issues_count: response.open_issues_count,
    avatar_url: response.owner?.avatar_url,
  });
}
