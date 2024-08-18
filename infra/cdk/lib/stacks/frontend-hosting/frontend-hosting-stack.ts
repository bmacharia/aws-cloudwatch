import { AppEnvironmentConfig } from '@/config';
import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as aws_cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { LambdaEdgeEventType } from 'aws-cdk-lib/aws-cloudfront';
import * as aws_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as aws_lambda from 'aws-cdk-lib/aws-lambda';
import * as aws_s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as path from 'path';
import { CloudFrontToS3 } from '@aws-solutions-constructs/aws-cloudfront-s3';

interface FrontendHostingStackProps extends Omit<StackProps, 'env'>, AppEnvironmentConfig {
  restApiUrl: string;
}

export class FrontendHostingStack extends Stack {
  bucket: aws_s3.Bucket;
  distribution: aws_cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendHostingStackProps) {
    super(scope, id, props);

    const lambdaAtEdge = new aws_cloudfront.experimental.EdgeFunction(this, 'LambdaAtEdge', {
      code: aws_lambda.Code.fromAsset(path.join(__dirname, '../../../../../backend/lambda/nextRouting/')),
      handler: 'index.handler',
      runtime: aws_lambda.Runtime.NODEJS_20_X,
    });

    const cfnToS3 = new CloudFrontToS3(this, 'SpaHosting', {
      insertHttpSecurityHeaders: false,
      bucketProps: {
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
      },
      cloudFrontDistributionProps: {
        defaultBehavior: {
          edgeLambdas: [
            {
              eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
              functionVersion: lambdaAtEdge.currentVersion,
            },
          ],
        },
      },
    });

    this.bucket = cfnToS3.s3Bucket!;
    this.distribution = cfnToS3.cloudFrontWebDistribution!;

    new CfnOutput(this, 'ExampleApplicationCloudfrontUrl', {
      value: this.distribution.distributionDomainName,
    });

    new CfnOutput(this, 'BucketName', {
      exportName: 'frontend-bucket-name',
      value: this.bucket.bucketName,
    });
  }
}
