var $M = $M || {};
$M.batch = {};

// ********************************************************************************
// Errors


$M.batch.EOFError = class extends Error { }

// ********************************************************************************
// Utility functions

$M.batch.LINE_SEPARATOR = '\r\n';

// Parse an HTTP response line by line.
$M.batch.LineParser = class {

  constructor(textContent) {
    this._textContent = textContent;
    this._index = 0;
  }

  nextLine() {
    if (this._index >= this._textContent.length) throw new $M.batch.EOFError();
    const endOfLineIndex = this._textContent.indexOf($M.batch.LINE_SEPARATOR, this._index);
    if (endOfLineIndex < 0) endOfLineIndex = this._textContent.length;
    const line = this._textContent.substring(this._index, endOfLineIndex);
    this._index = endOfLineIndex + $M.batch.LINE_SEPARATOR.length;
    return line;
  }

  remainingText() {
    const index = this._index;
    this._index = this._textContent.length;
    return this._textContent.substring(index);
  }

};

// Split a string in two parts.
$M.batch.split2 = (text, separator) => {
  const index = text.indexOf(separator);
  if (index < 0) return [text, null];
  else return [text.substring(0, index), text.substring(index + separator.length)];
};

// Parse the content type header.
$M.batch.parseContentType = (contentType) => {
  const parts = contentType.split(';').map(s => s.trim());
  const params = {};
  for (let i = 1; i < parts.length; ++i) {
    const [key, value] = $M.batch.split2(parts[i], '=');
    params[key] = value;
  }
  return {
    mediaType: parts[0],
    params
  };
};

// Get the boundary of a multipart/mixed response.
$M.batch.getResponseBoundary = (response) => {
  const headers = response.getHeaders();
  for (const key in headers) {
    if (key.toLowerCase() === 'content-type') {
      const parsedContentType = $M.batch.parseContentType(headers[key]);
      if (parsedContentType.mediaType.toLowerCase() !== 'multipart/mixed') {
        throw new Error(`Unexpected response content type: ${parsedContentType.mediaType}`);
      }
      return parsedContentType.params['boundary'];
    }
  }
};

$M.batch.forEachEntry = (entries, fn, opt_obj) => {
  if (Array.isArray(entries)) {
    entries.forEach(fn, opt_obj);
  } else if (entries) {
    for (const key in entries) fn.call(opt_obj, [key, entries[key]]);
  }
};

$M.batch.getQueryString = (params) => {
  let chunks = [];
  $M.batch.forEachEntry(params, ([key, value]) => {
    if (value !== undefined) chunks.push(`${key}=${encodeURIComponent(value)}`);
  });
  return chunks.length > 0 ? '?' + chunks.join('&') : '';
};

// ********************************************************************************
// Main functions

// Create the part of the multipart/mixed request for a single request.
$M.batch.getLinesForRequest = (boundary, request) => {
  const isJsonRequest = request.body && typeof request.body === 'object';
  const requestBody = isJsonRequest ? JSON.stringify(request.body) : request.body;
  const lines = [
    `--${boundary}`,
    'Content-Type: application/http',
    '',
    `${request.method || 'GET'} ${request.path}${$M.batch.getQueryString(request.params)}`,
    'Content-Length: ' + (requestBody ? requestBody.length : 0)
  ];
  const hasContentTypeHeader = false;
  $M.batch.forEachEntry(request.headers, ([key, value]) => {
    hasContentTypeHeader |= key.toLowerCase() === 'content-type';
    lines.push(key + ': ' + value);
  });
  if (isJsonRequest && !hasContentTypeHeader) lines.push('Content-Type: application/json');
  if (requestBody) lines.push('', requestBody);
  return lines;
};

// Parse a part of the multipart response.
$M.batch.parseResponsePart = (responsePart) => {
  const response = {};
  try {
    const parser = new $M.batch.LineParser(responsePart);
    // Ignore first line
    parser.nextLine();
    // Skip headers + empty line
    while (parser.nextLine()) { }

    // Parse status line
    const statusLine = parser.nextLine();
    if (!statusLine.startsWith('HTTP/1.1')) throw new Error();
    response.statusCode = parseInt(statusLine.split(' ')[1], 10);

    // Parse headers
    response.headers = {};
    for (let line = parser.nextLine(); line; line = parser.nextLine()) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        response.headers[key] = value;
      }
    }

    // Parse body
    response.body = parser.remainingText();
    const contentType = response.headers['content-type'];
    if (contentType && contentType.split(';')[0] === 'application/json') response.json = JSON.parse(response.body);
  } catch (error) {
    Logger.log(error);
    response.error = new Error('Malformed HTTP response');
  }
  return response;
};

/**
Run a batch API request (multipart/mixed).

@param {string} batchUrl
@param {Array<{
  method: string,
  path: string,
  headers?: Array.<[string, string]}|Object.<string, string>,
  body?: string|object>} requests   Array of sub-requests.
@param{{
  headers?: Array.<[string, string]}|Object.<string, string>,
  returnOnlyJson?: boolean,
  }?} opt_options
@returns {Array<{
  statusCode: number,
  headers: Object.<string, string>,
  body: string,
  json?: object}>}  Array of results.
*/
function batchRequest(batchUrl, requests, opt_options) {
  const options = opt_options || {};
  const requestBoundary = 'BOUNDARY_' + Utilities.getUuid();
  const requestBody = requests.map($M.batch.getLinesForRequest.bind(null, requestBoundary))
    .flat()
    .join($M.batch.LINE_SEPARATOR) + `${$M.batch.LINE_SEPARATOR}--${requestBoundary}--`;

  const response = UrlFetchApp.fetch(batchUrl, {
    method: 'POST',
    headers: {
      ...options.headers,
      'Content-Type': `multipart/mixed; boundary=${requestBoundary}`,
    },
    payload: requestBody  // TODO: Utilities.newBlob(requestBody).getBytes(),
  });

  const responseBoundary = $M.batch.getResponseBoundary(response);
  return response.getContentText()
    .split('--' + responseBoundary)
    .slice(1, -1)
    .map(responsePart => {
      const response = $M.batch.parseResponsePart(responsePart);
      return options.returnOnlyJson ?
        (response.error ? response : response.json) :
        response;
    });
}
