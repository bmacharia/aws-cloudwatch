import { AppEnvironmentConfig } from '@/config';
import { CloudFrontToS3 } from '@aws-solutions-constructs/aws-cloudfront-s3';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as aws_cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as aws_s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface FrontendHostingStackProps extends Omit<StackProps, 'env'>, AppEnvironmentConfig {
  restApiUrl: string;
}

export class FrontendHostingStack extends Stack {
  bucket: aws_s3.Bucket;
  distribution: aws_cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendHostingStackProps) {
    super(scope, id, props);

    const cfnToS3 = new CloudFrontToS3(this, 'SpaHosting', {
      insertHttpSecurityHeaders: false,
      bucketProps: {
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
      },
      cloudFrontDistributionProps: {
        defaultBehavior: {
          allowedMethods: aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: aws_cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy: aws_cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
        },
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: Duration.seconds(0),
          },
        ],
        defaultRootObject: 'index.html',
        httpVersion: aws_cloudfront.HttpVersion.HTTP2,
        viewerCertificate: {
          aliases: [],
          props: {
            cloudFrontDefaultCertificate: true,
            minimumProtocolVersion: 'TLSv1',
          },
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
