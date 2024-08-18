import { CfnOutput } from 'aws-cdk-lib';
import { FederatedPrincipal, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { CfnAppMonitor } from 'aws-cdk-lib/aws-rum';
import { CfnIdentityPool, CfnIdentityPoolRoleAttachment } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { AppEnvironmentConfig } from '@/config';

interface Props {
  frontendUrl: string;
  environmentName: AppEnvironmentConfig['name'];
}

export class RumConstruct extends Construct {
  rum: CfnAppMonitor;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { frontendUrl, environmentName } = props;

    const stackName = scope.node.id;
    const constructName = id;

    // Add the Cognito Identity Pool resource
    const rumIdentityPool = new CfnIdentityPool(this, 'RumIdentityPool', {
      identityPoolName: `${stackName}-${constructName}-RumIdentityPool`,
      allowUnauthenticatedIdentities: true,
      allowClassicFlow: true,
    });

    const rumGuestRole = new Role(this, 'RumGuestRole', {
      roleName: `${environmentName}-${stackName}-${constructName}-RumGuestRole`,
      assumedBy: new FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': rumIdentityPool.ref, // Use the reference to the Cognito Identity Pool
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    rumGuestRole.addToPolicy(
      new PolicyStatement({
        actions: ['rum:PutRumEvents'],
        resources: ['*'],
      })
    );

    new CfnIdentityPoolRoleAttachment(this, 'RumIdentityPoolRoleAttachment', {
      identityPoolId: rumIdentityPool.ref,
      roles: {
        unauthenticated: rumGuestRole.roleArn,
      },
    });

    this.rum = new CfnAppMonitor(this, 'Rum', {
      name: `${environmentName}-${stackName}-${constructName}-Rum`,
      domain: frontendUrl,
      appMonitorConfiguration: {
        enableXRay: true,
        allowCookies: true,
        sessionSampleRate: 1,
        telemetries: ['errors', 'performance', 'http'],
        guestRoleArn: rumGuestRole.roleArn,
        metricDestinations: [
          {
            destination: 'CloudWatch',
          },
        ],
      },
      cwLogEnabled: true,
      customEvents: {
        status: 'ENABLED',
      },
    });

    new CfnOutput(this, 'RumOutput', {
      exportName: 'rum-guest-role',
      value: rumGuestRole.roleArn,
    });

    new CfnOutput(this, 'RumIdentityPoolId', {
      exportName: 'rum-identity-pool-id',
      value: rumIdentityPool.attrId,
    });

    new CfnOutput(this, 'RumAppMonitorId', {
      exportName: 'rum-app-monitor-id',
      value: this.rum.attrId,
    });
  }
}
