#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AhmtMeCdkStack } from '../lib/ahmt-me-cdk-stack';

const app = new cdk.App();

new AhmtMeCdkStack(app, 'AhmtMeCdkStack', {
  env: { account: process.env.CDK_AHMT_ME_DEPLOY_ACCOUNT, region: process.env.CDK_AHMT_ME_DEPLOY_REGION },
});
