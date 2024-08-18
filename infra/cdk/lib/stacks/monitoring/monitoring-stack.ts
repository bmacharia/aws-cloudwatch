import { AppEnvironmentConfig } from '@/config';
import { RestApiConstruct } from '@/lib/stacks/apis/constructs/rest-api/rest-api-construct';
import { AlerterConstruct } from '@/lib/stacks/cloudwatch/constructs/alerter-construct/alerter-construct';
import { AnomalyDetectionConstruct } from '@/lib/stacks/monitoring/constructs/anomaly-detection/anomaly-detection-construct';
import { RumConstruct } from '@/lib/stacks/monitoring/constructs/rum/rum-construct';
import { SyntheticsConstruct } from '@/lib/stacks/monitoring/constructs/synthetics/synthetics-construct';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface MonitoringStackProps extends Omit<StackProps, 'env'>, AppEnvironmentConfig {
  frontendUrl: string;
  alerter: AlerterConstruct;
  restApi: RestApiConstruct;
}

/**
 * The Monitoring Stack contains all constructs that monitor the application after it was deployed.
 */

export class MonitoringStack extends Stack {
  rum: RumConstruct;
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { frontendUrl, alerter, restApi } = props;

    this.rum = new RumConstruct(this, 'RumConstruct', {
      frontendUrl,
      environmentName: props.name,
    });

    new SyntheticsConstruct(this, 'SyntheticsConstruct', {
      frontendUrl,
      restApiUrl: restApi.lambdaRestApi.url,
      rumMonitorName: this.rum.rum.name,
    });

    new AnomalyDetectionConstruct(this, 'AnomalyDetectionConstruct', {
      alerter,
      restApiConstruct: restApi,
    });
  }
}
