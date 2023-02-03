#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AhmtMeCdkStack } from '../lib/ahmt-me-cdk-stack';

const app = new cdk.App();

const isDev = !!process.env.IS_DEV;

console.log(`\x1b[33mEnvironment: ${isDev ? '\x1b[34mdev' : '\x1b[31mprod'}\x1b[0m`);

new AhmtMeCdkStack(app, 'AhmtMeCdkStack' + (isDev ? 'Dev' : ''), {
  env: { account: process.env.CDK_AHMT_ME_DEPLOY_ACCOUNT, region: process.env.CDK_AHMT_ME_DEPLOY_REGION }
}, isDev);
