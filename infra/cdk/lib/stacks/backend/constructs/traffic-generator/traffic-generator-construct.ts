import { LambdaWithLogGroup } from '@/lib/constructs/lambda-with-log-group/lambda-with-log-group-construct';
import { FeatureFlaggingConstruct } from '@/lib/stacks/cloudwatch/constructs/feature-flagging/feature-flagging-construct';
import { Duration, aws_events_targets } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { CfnFeature } from 'aws-cdk-lib/aws-evidently';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

interface Props {
  restApiUrl: string;
  featureFlaggingConstruct: FeatureFlaggingConstruct;
}

export class TrafficGeneratorConstruct extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { restApiUrl, featureFlaggingConstruct } = props;

    const featureFlagVariations = featureFlaggingConstruct.features.generate_traffic
      .variations as CfnFeature.VariationObjectProperty[];

    const lambda = new LambdaWithLogGroup(this, 'Lambda', {
      entry: path.join(__dirname, '../../../../../../../backend/lambda/traffic-generator.ts'),
      environment: {
        MAX_CONCURRENCY: '1',
        MAX_WAIT_SECONDS: '20',
        URLS: restApiUrl,
        EVIDENTLY_PROJECT_ARN: featureFlaggingConstruct.evidentlyProject.attrArn,
        // TODO: I think we can remove those?
        EVIDENTLY_FEATURE_GENERATETRAFFIC: featureFlaggingConstruct.features.generate_traffic.name,
        EVIDENTLY_FEATURE_GENERATETRAFFIC_VARIATIONS: featureFlagVariations
          .map((variation) => variation.variationName)
          .join(','),
      },
    });

    new Rule(this, 'Rule', {
      description: 'Run the traffic generation continously',
      schedule: Schedule.rate(Duration.minutes(10)),
      targets: [new aws_events_targets.LambdaFunction(lambda)],
    });

    lambda.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'evidently:ListProjects',
          'evidently:EvaluateFeature',
          'evidently:UpdateFeature',
          'evidently:GetFeature',
        ],
        resources: ['*'],
      })
    );
  }
}
