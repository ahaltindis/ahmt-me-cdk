import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Certificate, ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { ArnPrincipal, PolicyStatement, Role, User } from 'aws-cdk-lib/aws-iam';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

import { CFFunctions, createS3Distribution, initCFFunctions } from './cloudfront';

type ContentServing = {
  bucket: Bucket
  distributions: Distribution[]
}

export class AhmtMeCdkStack extends cdk.Stack {

  private cfFunctions: CFFunctions;

  constructor(scope: Construct, id: string, props?: cdk.StackProps, isDev?: boolean) {
    super(scope, id, props);

    this.cfFunctions = initCFFunctions(this);

    let ahmtMeCertificate;
    if (!isDev) {
      const ahmtMeCertificateArn = StringParameter.valueForStringParameter(this, '/ahmtme/certificate/arn');
      ahmtMeCertificate = Certificate.fromCertificateArn(this, 'AhmtMeCertificate', ahmtMeCertificateArn);
    }

    const contentServing = this.createContentServing(ahmtMeCertificate);
    this.createHugoDeployUserRole(contentServing);

    this.createCDNServing(ahmtMeCertificate);
  }

  private createContentServing(certificate?: ICertificate): ContentServing {
    const sourceBucket = new Bucket(this, 'SourceBucket');
    new cdk.CfnOutput(this, 'SiteBucketName', { value: sourceBucket.bucketName });

    const mainDomains = certificate ? ["ahmt.me", "www.ahmt.me", "ahmet.altindis.org"] : [];
    const trDomains = certificate ? ["tr.ahmt.me"] : [];
    const enDomains = certificate ? ["en.ahmt.me"] : [];

    const distribution = createS3Distribution(this, 'SourceCDN', sourceBucket, '/', certificate, mainDomains, this.cfFunctions.redirectHome);
    new cdk.CfnOutput(this, 'SiteDistributionId', { value: distribution.distributionId });

    const distributionTr = createS3Distribution(this, 'SourceCDNTr', sourceBucket, '/tr', certificate, trDomains, this.cfFunctions.appendIndex, '/404/index.html');
    new cdk.CfnOutput(this, 'SiteDistributionIdTr', { value: distributionTr.distributionId });

    const distributionEn = createS3Distribution(this, 'SourceCDNEn', sourceBucket, '/en', certificate, enDomains, this.cfFunctions.appendIndex);
    new cdk.CfnOutput(this, 'SiteDistributionIdEn', { value: distributionEn.distributionId });

    return {
      bucket: sourceBucket,
      distributions: [
        distribution,
        distributionTr,
        distributionEn
      ]
    }
  }

  private createCDNServing(certificate?: ICertificate) {
    const cdnBucket = new Bucket(this, 'CDNBucket');
    new cdk.CfnOutput(this, 'CDNBucketName', { value: cdnBucket.bucketName });

    const cdnDomains = certificate ? ["cdn.ahmt.me"] : [];
    createS3Distribution(this, 'CDN', cdnBucket, '/', certificate, cdnDomains);
  }

  private createHugoDeployUserRole(contentServing: ContentServing) {
    // The user that will create credentials
    const hugoDeployUser = new User(this, 'HugoDeployUser');

    // Role that will be assumed by user
    const hugoDeployRole = new Role(this, 'HugoDeployRole', {
      // Session tags needed by https://github.com/marketplace/actions/configure-aws-credentials-action-for-github-actions
      assumedBy: new ArnPrincipal(hugoDeployUser.userArn).withSessionTags()
    });

    // Bucket read/write
    contentServing.bucket.grantReadWrite(hugoDeployRole);

    // Cloudfront cache invalidation
    contentServing.distributions.forEach(distribution => {
      hugoDeployRole.addToPolicy(new PolicyStatement({
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
    })

    // Cloudformation read export values (i.e. bucket name, distribution id)
    hugoDeployRole.addToPolicy(new PolicyStatement({
      actions: [
        'cloudformation:DescribeStacks',
      ],
      resources: [this.stackId],
    }));

  }
}
