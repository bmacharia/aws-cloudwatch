import { Environment } from 'aws-cdk-lib';
import { readFileSync } from 'fs';
import { resolve } from 'path';

type EnvName = 'dev' | 'prod';
type Arn = `arn:aws:${string}:${string}:${number}:${string}`;
type DiscordWebhookUrl = `https://discord.com/api/webhooks/${string}`;

// Add a discord webhook URL if you want to receive any alerts
const DISCORD_TEST_WEBHOOK_URL = undefined;

export interface AppEnvironmentConfig {
  name: EnvName;
  env: Required<Environment>;
  discordWebhooks: {
    awsNotifications: DiscordWebhookUrl | undefined;
  };
  alarmEmails: string[];
  shouldSendAlarmNotifications: boolean;
  layers: {
    insights: Arn;
  };
  defaultTags: {
    Environment: 'dev' | 'prod';
    App: 'cw-ho-tf';
    Iac: 'cdk' | 'tf';
  };
}

const envFilePath = resolve(__dirname, 'variables.env');
const envFileContent = readFileSync(envFilePath, 'utf-8');
const envVariables = envFileContent.split('\n').reduce((acc, line) => {
  const [key, value] = line.split('=');
  if (key && value) {
    acc[key.trim()] = value.trim();
  }
  return acc;
}, {} as Record<string, string>);

const accountId = envVariables['aws_account_id'];

if (!accountId) {
  throw new Error('aws_account_id is not defined in the environment variables');
}

export const devEnvironment: AppEnvironmentConfig = {
  name: 'dev',
  env: {
    account: accountId,
    region: 'us-east-1',
  },
  discordWebhooks: {
    awsNotifications: DISCORD_TEST_WEBHOOK_URL,
  },
  // You can add your email here to receive alarms
  alarmEmails: [],
  shouldSendAlarmNotifications: true,
  layers: {
    insights: 'arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension-Arm64:11',
  },
  defaultTags: {
    Environment: 'dev',
    App: 'cw-ho-tf',
    Iac: 'cdk',
  },
};