export const Constants = {
  GitHubRegex:
    /^(https?:\/\/github\.com\/)?([a-zA-Z0-9](?:-?[a-zA-Z0-9]){0,38})\/([a-zA-Z0-9](?:[._-]?[a-zA-Z0-9]+)*[a-zA-Z0-9])$/,
  ApiGatewayUrl: process.env.NEXT_PUBLIC_APIGW_REST!,
  AwsRegion: process.env.NEXT_PUBLIC_AWS_REGION!,
  RumIdentityPoolId: process.env.NEXT_PUBLIC_RUM_IDENTITY_POOL_ARN,
  RumMonitorId: process.env.NEXT_PUBLIC_RUM_MONITOR_ID!,
  RumGuestRoleArn: process.env.NEXT_PUBLIC_RUM_GUEST_ROLE_ARN,
  WebsocketUrl: process.env.NEXT_PUBLIC_APIGW_WS!,
};

if (!Constants.ApiGatewayUrl || Constants.ApiGatewayUrl === '') {
  throw new Error('API URL not defined');
}
