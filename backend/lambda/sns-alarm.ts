import { Tracer } from '@aws-lambda-powertools/tracer';
import { SNSEvent } from 'aws-lambda';
import axios from 'axios';
import { z } from 'zod';
import { EvidentlyAdapter } from './adapter/evidently/evidently.adapter';
import { logger } from './utils/logger';
import { getEnvVarOrThrow } from './utils/utils';

const AWS_AVATAR = 'https://a0.awsstatic.com/libra-css/images/logos/aws_logo_smile_1200x630.png';
const RED = 16711680;

// Captures HTTP calls in X-Ray
const tracer = new Tracer({ serviceName: 'sns-alarm-handler', captureHTTPsRequests: true });

const evidently = new EvidentlyAdapter(tracer);

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const alarmMessageSchema = z.object({
  AlarmName: z.string(),
  AlarmDescription: z.string().optional().nullable(),
});

export const handler = async (event: SNSEvent): Promise<void> => {
  logger.info('Incoming SNS event', { event });

  if (!DISCORD_WEBHOOK_URL) {
    logger.warn('Discord webhooks are not configured. Exiting.');
    return;
  }

  const { Records } = event;

  const alarmMessages = Records.map((record) => alarmMessageSchema.parse(JSON.parse(record.Sns.Message)));

  await Promise.all(
    alarmMessages.map(async (alarmMessage) => {
      logger.info('Message', { alarmMessage });

      const discordData = createDiscordData(alarmMessage);

      logger.info('DiscordData', { discordData });

      await axios.post(DISCORD_WEBHOOK_URL, discordData);

      // Just for demo purposes: if there are REST API errors, stop all experiments automatically
      if (alarmMessage.AlarmName.endsWith('errors-rest-api')) {
        await evidently.stopAllExperiments();
      }
    })
  );
};

function createDiscordData(alarmMessage: z.infer<typeof alarmMessageSchema>) {
  const { AlarmName, AlarmDescription } = alarmMessage;

  return {
    username: 'AWS CloudWatch',
    avatar_url: AWS_AVATAR,
    embeds: [
      {
        title: `Alarm: ${AlarmName}`,
        description: AlarmDescription,
        color: RED,
      },
    ],
  };
}
