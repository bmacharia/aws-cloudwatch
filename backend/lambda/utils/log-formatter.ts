import { LogFormatter, LogItem } from '@aws-lambda-powertools/logger';
import { LogAttributes, UnformattedAttributes } from '@aws-lambda-powertools/logger/types';

class GithubTrackerLogFormatter extends LogFormatter {
  public formatAttributes(attributes: UnformattedAttributes, additionalLogAttributes: LogAttributes): LogItem {
    const baseAttributes = {
      logLevel: attributes.logLevel,
      message: attributes.message,
      environment: attributes.environment,
      awsRegion: attributes.awsRegion,
      correlationIds: {
        awsRequestId: attributes.lambdaContext?.awsRequestId,
        xRayTraceId: attributes.xRayTraceId,
      },
      lambdaFunction: {
        name: attributes.lambdaContext?.functionName,
        arn: attributes.lambdaContext?.invokedFunctionArn,
        memoryLimitInMB: attributes.lambdaContext?.memoryLimitInMB,
        version: attributes.lambdaContext?.functionVersion,
        coldStart: attributes.lambdaContext?.coldStart,
      },
      timestamp: this.formatTimestamp(attributes.timestamp),
      logger: {
        sampleRateValue: attributes.sampleRateValue,
      },
    };
    // Create a new LogItem with the base attributes
    const logItem = new LogItem({ attributes: baseAttributes });

    // Merge additional attributes
    logItem.addAttributes(additionalLogAttributes);

    return logItem;
  }
}

export { GithubTrackerLogFormatter };
