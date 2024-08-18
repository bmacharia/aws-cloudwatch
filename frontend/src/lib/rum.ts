import { AwsRum, AwsRumConfig } from 'aws-rum-web';
import { Constants } from './constants';

export const bootstrapRum = (): AwsRum | undefined => {
  try {
    if (!Constants.RumIdentityPoolId || !Constants.RumGuestRoleArn) {
      throw new Error('Missing RUM Identity Pool ID or Guest Role ARN');
    }
    // do not instantiate AWS RUM if we are on localhost
    if (window.location.hostname === 'localhost') {
      return;
    }
    const identityPoolId = Constants.RumIdentityPoolId;
    const guestRoleArn = Constants.RumGuestRoleArn;

    const config: AwsRumConfig = {
      sessionSampleRate: 1.0,
      endpoint: `https://dataplane.rum.${Constants.AwsRegion}.amazonaws.com`,
      telemetries: [['http', { recordAllRequests: true }], 'errors', 'performance'],
      identityPoolId,
      guestRoleArn,
      allowCookies: true,
      enableXRay: true,
    };

    const APPLICATION_ID: string = Constants.RumMonitorId;
    const APPLICATION_VERSION: string = '1.0.0';
    const APPLICATION_REGION: string = Constants.AwsRegion;

    const awsRum: AwsRum = new AwsRum(APPLICATION_ID, APPLICATION_VERSION, APPLICATION_REGION, config);
    console.log(
      `AWS RUM initialized [awsRegion=${Constants.AwsRegion}, identityPoolId=${identityPoolId}, guestRoleArn=${guestRoleArn}, appMonitorId=${Constants.RumMonitorId}]`
    );
    return awsRum;
  } catch (error) {
    console.error(`Failed to initialize AWS RUM: ${error}`);
  }
};
