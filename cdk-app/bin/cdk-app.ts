#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ProductSpecsApiStack } from '../lib/cdk-app-stack';

const app = new cdk.App();
new ProductSpecsApiStack(app, 'ProductSpecsApiStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
});