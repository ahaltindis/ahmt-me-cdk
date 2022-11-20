import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class AhmtMeCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sourceBucket = new s3.Bucket(this, 'SourceBucket');
    new cdk.CfnOutput(this, 'SiteBucketName', { value: sourceBucket.bucketName });

    const ahmtMeCertificateArn = ssm.StringParameter.valueForStringParameter(this, '/ahmtme/certificate/arn');
    const ahmtMeCertificate = acm.Certificate.fromCertificateArn(this, 'AhmtMeCertificate', ahmtMeCertificateArn);

    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront-readme.html#cloudfront-function
    const urlRewriteAppendIndexFunction = new cloudfront.Function(this, 'UrlRewriteAppendIndexFunction', {
      code: cloudfront.FunctionCode.fromFile({
        filePath: "./cloud-functions/url_rewrite_append_index.js"
      })
    });

    const distribution = new cloudfront.Distribution(this, 'SourceCDN', {
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      certificate: ahmtMeCertificate,
      domainNames: [
        'ahmt.me',
        'www.ahmt.me',
        'ahmet.altindis.org'
      ],
      defaultBehavior: {
        origin: new origins.S3Origin(sourceBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          {
            function: urlRewriteAppendIndexFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 404,
          responsePagePath: '/404.html'
        }
      ]
    });
    new cdk.CfnOutput(this, 'SiteDistributionId', { value: distribution.distributionId });

  }
}
