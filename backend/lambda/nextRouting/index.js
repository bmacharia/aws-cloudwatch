// check if url has extension like .html
const hasExtension = /(.+)\.[a-zA-Z0-9]{2,5}$/;
// check if url end with '/'
const hasSlash = /\/$/;
// check for dynamic routes
const dynamicPortfolioRoutes = /\/portfolios\/\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/;

exports.handler = async (event, context, callback) => {
  const { request } = event.Records[0].cf;
  console.log('req', request);
  const url = request.uri;

  if (url) {
    // check for fixed route
    if (!url.match(hasExtension) && !url.match(hasSlash)) {
      request.uri = `${url}.html`;
      return callback(null, request);
    }
  }
  // If nothing matches, return request unchanged
  return callback(null, request);
};
