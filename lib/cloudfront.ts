import { Construct } from "constructs";

import { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import {
  Distribution,
  FunctionEventType,
  IFunction,
  Function,
  PriceClass,
  ViewerProtocolPolicy,
  FunctionAssociation,
  FunctionCode,
} from "aws-cdk-lib/aws-cloudfront";
import { Bucket } from "aws-cdk-lib/aws-s3";

export type CFFunctions = {
  redirectHome: Function;
  appendIndex: Function;
};

export function initCFFunctions(scope: Construct): CFFunctions {
  const urlRedirectHomeFunction = new Function(
    scope,
    "UrlRedirectHomeFunction",
    {
      code: FunctionCode.fromFile({
        filePath: "./cloud-functions/redirect_home.js",
      }),
    }
  );

  // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront-readme.html#cloudfront-function
  const urlRewriteAppendIndexFunction = new Function(
    scope,
    "UrlRewriteAppendIndexFunction",
    {
      code: FunctionCode.fromFile({
        filePath: "./cloud-functions/url_rewrite_append_index.js",
      }),
    }
  );

  return {
    redirectHome: urlRedirectHomeFunction,
    appendIndex: urlRewriteAppendIndexFunction,
  };
}

export function createS3Distribution(
  scope: Construct,
  id: string,
  bucket: Bucket,
  pathInBucket: string,
  certificate?: ICertificate,
  domains?: string[],
  request_function?: IFunction,
  errorPath?: string
) {
  const functionAssociations: FunctionAssociation[] = [];
  if (request_function) {
    functionAssociations.push({
      function: request_function,
      eventType: FunctionEventType.VIEWER_REQUEST,
    });
  }

  return new Distribution(scope, id, {
    priceClass: PriceClass.PRICE_CLASS_100,
    certificate: certificate,
    domainNames: domains,
    defaultBehavior: {
      origin: new S3Origin(bucket, { originPath: pathInBucket }),
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      functionAssociations,
    },
    defaultRootObject: "index.html",
    errorResponses: [
      {
        httpStatus: 403,
        responseHttpStatus: 404,
        responsePagePath: errorPath ? errorPath : "/404.html",
      },
    ],
  });
}
