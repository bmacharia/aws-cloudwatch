const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS,POST,PUT',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
  'x-build-timestamp': process.env.BUILD_TIMESTAMP!,
};

export enum HttpMethods {
  GET = 'GET',
  DELETE = 'DELETE',
  POST = 'POST',
  OPTIONS = 'OPTIONS',
}

export const returnSuccess = (statusCode = 200, body: any = { message: 'OK' }) => ({
  statusCode,
  headers,
  body: JSON.stringify(typeof body === 'object' ? body : { message: body }),
});

export const returnError = (statusCode = 400, error: string) => ({
  statusCode,
  headers,
  body: JSON.stringify({ error }),
});
