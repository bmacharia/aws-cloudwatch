import { Logger } from '@aws-lambda-powertools/logger';
import { GithubTrackerLogFormatter } from './log-formatter';

export const logger = new Logger({
  sampleRateValue: 0.1,
  serviceName: 'repo-tracker',
  logFormatter: new GithubTrackerLogFormatter(),
});
