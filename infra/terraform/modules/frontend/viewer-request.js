function handler(event) {
    var request = event.request;
    var headers = request.headers;

    var authString = 'Basic ${base64encode("${basic_auth_username}:${basic_auth_password}")}';

    if (headers.authorization && headers.authorization.value === authString) {
        return request;
    }

    return {
        statusCode: 401,
        statusDescription: 'Unauthorized',
        headers: {
            'www-authenticate': { value: 'Basic' }
        }
    };
}