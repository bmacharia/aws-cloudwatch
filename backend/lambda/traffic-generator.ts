import { Tracer } from '@aws-lambda-powertools/tracer';
import axios from 'axios';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { EvidentlyAdapter, FeatureFlag } from './adapter/evidently/evidently.adapter';
import { logger } from './utils/logger';
import { RepositoryExamples } from './utils/repository-examples';

const maxConcurrency = process.env.MAX_CONCURRENCY ? Number(process.env.MAX_CONCURRENCY) : 5;
const maxWaitSeconds = process.env.MAX_WAIT_SECONDS ? Number(process.env.MAX_WAIT_SECONDS) : 5;

const tracer = new Tracer({ serviceName: 'repo-tracker', captureHTTPsRequests: true });
const evidently = new EvidentlyAdapter(tracer);

const getClients = (urls = process.env.URLS) =>
  (urls?.split(',') ?? []).map((baseURL) => {
    logger.info(`Creating client for ${baseURL}`);
    return axios.create({
      baseURL,
      timeout: 5000,
    });
  });

export const handler = async ({ urls }: { urls?: string | undefined } = {}) => {
  const trafficVariation = (await evidently.evaluate<string>(FeatureFlag.GenerateTraffic)) as
    | 'none'
    | 'low'
    | 'medium'
    | 'high';
  if (trafficVariation === 'none') {
    logger.info('Traffic generation is disabled.');
    return;
  }
  logger.info('Traffic generation is enabled with variation', { trafficVariation });

  let maxWait: number;
  if (trafficVariation === 'low') {
    maxWait = maxWaitSeconds;
  } else if (trafficVariation === 'medium') {
    maxWait = Math.round(maxWaitSeconds / 2);
  } else if (trafficVariation === 'high') {
    maxWait = Math.round(maxWaitSeconds / 4);
  }

  const clients = getClients(urls);
  for await (const client of clients) {
    const currentlyProcessing = new Set();

    const { data: favs } = await client.get<{ full_name: string }[]>(`/repositories`);

    const concurrency = Math.floor(Math.random() * maxConcurrency) + 1;

    logger.info('Starting generating traffic', { concurrency });

    for await (const _ of Array.from({ length: concurrency })) {
      const repos = RepositoryExamples.sort(() => Math.random() - 0.5);
      await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * maxWait * 1000)));

      // Find a random repository to unfavorite that is not currently being processed
      let unfavorite;
      for (let i = 0; i < favs.length; i++) {
        const index = Math.floor(Math.random() * favs.length);
        const repo = favs[index];
        if (!currentlyProcessing.has(repo.full_name)) {
          unfavorite = repo;
          break;
        }
      }

      // Find a random repository to favorite that is not already in the list and not currently being processed
      let favorite;
      for (const repo of repos) {
        if (!favs.find((fav) => fav.full_name === repo.full_name) && !currentlyProcessing.has(repo.full_name)) {
          favorite = repo;
          break;
        }
      }

      if (unfavorite) {
        currentlyProcessing.add(unfavorite.full_name);
        logger.info(`Removing ${unfavorite.full_name} from favorites`);
        await client.delete(`/repositories/${encodeURIComponent(unfavorite.full_name)}`);
        currentlyProcessing.delete(unfavorite.full_name);
      }
      if (favorite) {
        currentlyProcessing.add(favorite.full_name);
        logger.info(`Adding ${favorite.full_name} to favorites`);
        await client.post(`/repositories`, { full_name: favorite.full_name });
        currentlyProcessing.delete(favorite.full_name);
      }
    }
  }
};

// for local testing
if (!process.env.AWS_REGION) {
  const environment = process.env.ENVIRONMENT ?? 'dev';
  // check that environment file exists
  const envFile = join(__dirname, `../../.env.${environment}`);
  logger.info(`Looking for environment file ${envFile}`);
  if (!existsSync(envFile)) {
    logger.error(`Environment file ${envFile} not found.`);
    process.exit(1);
  }
  // read the 'APIGW_REST' env variable from .env.prod file
  const urls = execSync(`grep 'APIGW_REST' ${join(__dirname, `../../.env.${environment}`)} | cut -d '=' -f2`)
    .toString()
    .trim();
  logger.info(`Running generator for environment ${environment} and URL ${urls}`);
  handler({ urls });
}
