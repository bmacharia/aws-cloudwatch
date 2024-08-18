import { Duration, Tags } from 'aws-cdk-lib';
import { Canary, Code, Runtime, Schedule } from 'aws-cdk-lib/aws-synthetics';
import { Construct } from 'constructs';
import * as path from 'path';
interface Props {
  frontendUrl: string;
  restApiUrl: string;
  rumMonitorName: string;
}

export class SyntheticsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { frontendUrl, restApiUrl, rumMonitorName } = props;

    const listOfCanaries = ['journey', 'api', 'heart', 'links', 'visual'];

    // Iterate through list of canaries and create them
    for (const name of listOfCanaries) {
      this.createCanary(name, frontendUrl, restApiUrl, rumMonitorName);
    }
  }

  // Create new function that creates canaries dynamically
  private createCanary(name: string, frontendUrl: string, restApiUrl: string, rumMonitorName: string) {
    const canary = new Canary(this, name, {
      schedule: Schedule.cron({
        minute: '0/15',
        hour: '6',
        month: '*',
        weekDay: 'MON-FRI',
      }),
      // we've experienced issues with the latest 2 runtimes with Visual Monitoring
      // please downgrade this to 6.2 if you experience the same issues!
      runtime: Runtime.SYNTHETICS_NODEJS_PUPPETEER_6_2,
      test: {
        code: Code.fromAsset(path.join(__dirname, '../../../../../../../backend/lambda/canaries')),
        handler: `canary_${name}.handler`,
      },
      startAfterCreation: true,
      environmentVariables: {
        FRONTEND_URL: `https://${frontendUrl}`,
        BACKEND_URL: restApiUrl,
      },
    });

    const alarm = canary
      .metricFailed({ period: Duration.minutes(5), statistic: 'sum' })
      .createAlarm(this, `FailureAlarm${name}`, {
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `The '${name}' canary has failed.`,
      });

    // We need to add this to connect it to RUM
    // https://repost.aws/en/questions/QUkuccNLHoS8K-1f-QSLjSRg/linking-cloudwatch-rum-app-to-cloudwatch-canary
    Tags.of(alarm).add(rumMonitorName, '');

    return canary;
  }
}
