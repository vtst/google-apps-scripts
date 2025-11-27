var $M = $M || {};
$M.batch = {};

// ********************************************************************************
// Errors

class BatchRequestError extends Error {
  constructor(code, details) {
    super(`Batch request failed (${code}): ${details}`);
    this.code = code;
  }
}

$M.batch.EOFError = class extends Error {}

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

}

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

/**
Run a batch API request (multipart/mixed).

@param {Array<{
  method: string,
  path: string,
  headers?: Array.<[string, string]}|Object.<string, string>,
  body?: string|object>} requests   Array of sub-requests.
@returns {Array<{
  statusCode: number,
  headers: Object.<string, string>,
  body: string,
  json?: object}>}  Array of results.
*/
function batchRequest(batchUrl, requests) {
  const oAuthToken = ScriptApp.getOAuthToken();
  const requestBoundary = 'BOUNDARY_' + Utilities.getUuid();
  const body = requests.map((request, index) => {
    const isJsonRequest = request.body && typeof request.body === 'object';
    const requestBody = isJsonRequest ? JSON.stringify(request.body) : request.body;
    const lines = [
      `--${requestBoundary}`,
      'Content-Type: application/http',
      `content-id: request-${index}`,
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
  }).flat().join($M.batch.LINE_SEPARATOR) + `${$M.batch.LINE_SEPARATOR}--${requestBoundary}--`;

  const response = UrlFetchApp.fetch(batchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/mixed; boundary=${requestBoundary}`,
      'Authorization': 'Bearer ' + oAuthToken
    },
    payload: Utilities.newBlob(body).getBytes(),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new BatchRequestError(response.getResponseCode(), response.getContentText());
  }

  const responseBoundary = $M.batch.getResponseBoundary(response);
  return response.getContentText()
    .split('--' + responseBoundary)
    .slice(1, -1)
    .map(part => {
      try {
        const parser = new $M.batch.LineParser(part);
        // Ignore first line
        parser.nextLine();
        // Skip headers + empty line
        while (parser.nextLine()) {}

        // Parse status line
        const statusLine = parser.nextLine();
        if (!statusLine.startsWith('HTTP/1.1')) throw new Error();      
        const statusCode = parseInt(statusLine.split(' ')[1], 10);

        // Parse headers
        const headers = {};
        for (let line = parser.nextLine(); line; line = parser.nextLine()) {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim().toLowerCase();
            const value = line.substring(colonIndex + 1).trim();
            headers[key] = value;
          }
        }

        // Parse body
        const body = parser.remainingText();
        const json = (headers['content-type'] || '').split(';')[0] === 'application/json' ? JSON.parse(body) : undefined;

        return {statusCode, headers, body, json};
      } catch (error) {
        return {error: 'Malformed HTTP response'};
      }
    });
}

/**
Run a batch API request (multipart/mixed). Return only the JSON response objects.

@param {Array<{
  method: string,
  path: string,
  headers?: Array.<[string, string]}|Object.<string, string>,
  body?: string|object>} requests   Array of sub-requests.
@returns {Array<object>}  Array of response objects.
*/
function batchRequestJson(batchUrl, requests) {
  return batchRequest(batchUrl, requests).map(response => {
    if (response.error) {
      return {error: {message: response.error}};
    } else if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.json;
    } else {
      return response.json;
    }
  });
}