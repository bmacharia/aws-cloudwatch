import { AppEnvironmentConfig } from '@/config';
import { CfnFeature, CfnLaunch, CfnProject, CfnSegment, CfnProjectProps } from 'aws-cdk-lib/aws-evidently';
import { Construct } from 'constructs';

interface Props {
  environment: AppEnvironmentConfig['name'];
}

export class FeatureFlaggingConstruct extends Construct {
  evidentlyProject: CfnProject;
  features: Record<'show_stars' | 'show_searchbar' | 'generate_traffic' | 'generate_errors', CfnFeature> = {
    show_stars: {} as CfnFeature,
    show_searchbar: {} as CfnFeature,
    generate_traffic: {} as CfnFeature,
    generate_errors: {} as CfnFeature,
  };

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { environment } = props;

    const stackName = scope.node.id;
    const constructName = id;

    this.evidentlyProject = new CfnProject(this, 'EvidentlyProject', {
      description: 'Learning about feature flags and A/B testing!',
      name: `${environment}-${stackName}-${constructName}-Project`,
    });

    this.features['show_stars'] = this.createFeature({
      name: `show_stars`,
      project: this.evidentlyProject,
      variations: [
        {
          booleanValue: false,
          variationName: 'false',
        },
        {
          booleanValue: true,
          variationName: 'true',
        },
      ],
    });

    this.features['show_searchbar'] = this.createFeature({
      name: `show_searchbar`,
      project: this.evidentlyProject,
      variations: [
        {
          booleanValue: false,
          variationName: 'false',
        },
        {
          booleanValue: true,
          variationName: 'true',
        },
      ],
    });

    this.features['generate_traffic'] = this.createFeature({
      name: `generate_traffic`,
      project: this.evidentlyProject,
      variations: [
        {
          stringValue: 'none',
          variationName: 'none',
        },
        {
          stringValue: 'low',
          variationName: 'low',
        },
        {
          stringValue: 'medium',
          variationName: 'medium',
        },
        {
          stringValue: 'high',
          variationName: 'high',
        },
      ],
    });

    this.features['generate_errors'] = this.createFeature({
      name: `generate_errors`,
      project: this.evidentlyProject,
      variations: [
        {
          stringValue: 'none',
          variationName: 'none',
        },
        {
          stringValue: 'github-api',
          variationName: 'github-api',
        },
        {
          stringValue: 'websockets',
          variationName: 'websockets',
        },
        {
          stringValue: 'rest-api',
          variationName: 'rest-api',
        },
      ],
    });
  }

  createFeature({
    name,
    variations,
    project,
  }: {
    name: string;
    variations: CfnFeature.VariationObjectProperty[];
    project: CfnProject;
  }) {
    return new CfnFeature(this, name, {
      name,
      project: project.attrArn,
      variations,
    });
  }
}
