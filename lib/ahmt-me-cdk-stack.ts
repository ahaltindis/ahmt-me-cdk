import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';

export class AhmtMeCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps, isDev?: boolean) {
    super(scope, id, props);

    const sourceBucket = new s3.Bucket(this, 'SourceBucket');
    new cdk.CfnOutput(this, 'SiteBucketName', { value: sourceBucket.bucketName });

    let ahmtMeCertificate;
    if (!isDev) {
      const ahmtMeCertificateArn = ssm.StringParameter.valueForStringParameter(this, '/ahmtme/certificate/arn');
      ahmtMeCertificate = acm.Certificate.fromCertificateArn(this, 'AhmtMeCertificate', ahmtMeCertificateArn);
    }

    const urlRedirectHomeFunction = new cloudfront.Function(this, 'UrlRedirectHomeFunction', {
      code: cloudfront.FunctionCode.fromFile({
        filePath: "./cloud-functions/redirect_home.js"
      })
    });

    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront-readme.html#cloudfront-function
    const urlRewriteAppendIndexFunction = new cloudfront.Function(this, 'UrlRewriteAppendIndexFunction', {
      code: cloudfront.FunctionCode.fromFile({
        filePath: "./cloud-functions/url_rewrite_append_index.js"
      })
    });

    const distribution = new cloudfront.Distribution(this, 'SourceCDN', {
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      certificate: ahmtMeCertificate,
      domainNames: ahmtMeCertificate ? [
        'ahmt.me',
        'www.ahmt.me',
        'ahmet.altindis.org'
      ] : [],
      defaultBehavior: {
        origin: new origins.S3Origin(sourceBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          {
            function: urlRedirectHomeFunction,
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

    const distributionTr = new cloudfront.Distribution(this, 'SourceCDNTr', {
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      certificate: ahmtMeCertificate,
      domainNames: ahmtMeCertificate ? [
        'tr.ahmt.me',
      ] : [],
      defaultBehavior: {
        origin: new origins.S3Origin(sourceBucket, {originPath: '/tr'}),
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
          responsePagePath: '/404/index.html'
        }
      ]
    });
    new cdk.CfnOutput(this, 'SiteDistributionIdTr', { value: distributionTr.distributionId });

    const distributionEn = new cloudfront.Distribution(this, 'SourceCDNEn', {
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      certificate: ahmtMeCertificate,
      domainNames: ahmtMeCertificate ? [
        'en.ahmt.me',
      ] : [],
      defaultBehavior: {
        origin: new origins.S3Origin(sourceBucket, {originPath: '/en'}),
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
    new cdk.CfnOutput(this, 'SiteDistributionIdEn', { value: distributionEn.distributionId });

    this.createHugoDeployUserRole(sourceBucket, distribution);
  }

  private createHugoDeployUserRole(sourceBucket: s3.Bucket, distribution: cloudfront.Distribution) {
    // The user that will create credentials
    const hugoDeployUser = new iam.User(this, 'HugoDeployUser');

    // Role that will be assumed by user
    const hugoDeployRole = new iam.Role(this, 'HugoDeployRole', {
      // Session tags needed by https://github.com/marketplace/actions/configure-aws-credentials-action-for-github-actions
      assumedBy: new iam.ArnPrincipal(hugoDeployUser.userArn).withSessionTags()
    });

    // Bucket read/write
    sourceBucket.grantReadWrite(hugoDeployRole);

    // Cloudfront cache invalidation
    hugoDeployRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'cloudfront:CreateInvalidation',
      ],
      resources: [this.formatArn({
        arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
        service: 'cloudfront',
        resource: 'distribution',
        resourceName: distribution.distributionId,
        region: '' // cloudfront has no region!
      })],
    }));

    // Cloudformation read export values (i.e. bucket name, distribution id)
    hugoDeployRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'cloudformation:DescribeStacks',
      ],
      resources: [this.stackId],
    }));

  }
}
