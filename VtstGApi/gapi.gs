swby.lang.namespace('sce.gapi');

// *************************************************************************
// Module sce.gapi.x

swby.lang.namespace('sce.gapi.x');

sce.gapi.x.URL_REWRITE_FUNCTIONS_ = [];

/**
@param {function(string): string} fn
*/
sce.gapi.x.addUrlRewriteFunction = function(fn) {
  sce.gapi.x.URL_REWRITE_FUNCTIONS_.push(fn);
};

/**
@param {string} url
@return {string}
*/
sce.gapi.x.rewriteUrl_ = function(url) {
  sce.gapi.x.URL_REWRITE_FUNCTIONS_.forEach(function(fn) {
    url = fn(url);
  });
  return url;
};

// *************************************************************************
// Module sce.gapi.utils_

swby.lang.namespace('sce.gapi.utils_');

/**
@param {Object} obj
@param {Array.<string>=} opt_fields
@return {Object}
 */
sce.gapi.utils_.clone = function(obj, opt_fields) {
  var clone = {};
  if (opt_fields) {
    opt_fields.forEach(function(field) { clone[field] = obj[field]; });
  } else {
    for (var key in obj) clone[key] = obj[key];
  }
  return clone;
};

/**
@param {function(this: CONTEXT, T): S} fn
@param {Array.<T>} arr
@param {CONTEXT?} opt_context
@return {Array.<S>}
 */
sce.gapi.utils_.map = function(fn, arr, opt_context) {
  var result = [];
  arr.forEach(function(element, index) {
    result.push(fn.call(opt_context, element, index));
  });
  return result;
};

/**
@param {function(this: CONTEXT, {key: K, value: T}): S} fn
@param {Object.<K, T>} obj
@param {CONTEXT?} opt_context
@return {Array.<S>}
 */
sce.gapi.utils_.mapDict = function(fn, obj, opt_context) {
  var result = [];
  for (var key in obj) {
    result.push(fn.call(opt_context, {key: key, value: obj[key]}, index));
  }
  return result;
};

/**
@param {{key: string, value: string}} entry
@return {string}
 */
sce.gapi.utils_.buildUrlComponent = function(entry) {
  return encodeURIComponent(entry.key) + '=' + encodeURIComponent(entry.value);
};

/**
@param {string} path
@param {(Array.<{key: string, value: string}>|Object.<string, string>)=} opt_params
@return {string}
*/
sce.gapi.utils_.buildUrl = function(path, opt_params) {
  var url = path;
  if (opt_params) {
    if (opt_params instanceof Array) {
      var params = sce.gapi.utils_.map(sce.gapi.utils_.buildUrlComponent, opt_params);
    } else {
      var params = sce.gapi.utils_.mapDict(sce.gapi.utils_.buildUrlComponent, opt_params);      
    }
    if (params.length > 0) url += '?' + params.join('&');      
  }
  return url;
};


/**
@param {Object.<string, string>} headers
@param {string} line
@return {{key: string, value: string}}
*/
sce.gapi.utils_.parseResponseHeader = function(headers, line) {
  var index = line.indexOf(':');
  if (index >= 0) {
    headers[line.substr(0, index).toLowerCase()] = line.substr(index + (line.charAt(index + 1) == ' ' ? 2 : 1));
  }
};

/**
@param {string} headers
@return {Object.<string, string>}
 */
sce.gapi.utils_.parseResponseHeaders = function(str) {
  var headers = {};
  if (str) {
    str.split('\r\n').forEach(function(line) {
      sce.gapi.utils_.parseResponseHeader(headers, line);
    });
  }
  return headers;
};

// *************************************************************************
// Class sce.gapi.utils_.LineReader

/**
@param {string} text
@constructor
*/
sce.gapi.utils_.LineReader = function(text) {
  /** @private {string} */
  this.text_ = text;
  /** @private {number} */
  this.position_ = 0;
};

/**
@param {string}
@return {string}
*/
sce.gapi.utils_.LineReader.prototype.substring_ = function(text, start, end) {
  return text.substring(start, text.charAt(end - 1) == '\r' ? end - 1 : end);
};

/**
@return {string}
*/
sce.gapi.utils_.LineReader.prototype.getLine = function() {
  var start = this.position_;
  this.position_ = this.text_.indexOf('\n', start) + 1;
  if (this.position_ == 0) {
    this.position_ = this.text_.length;
    return this.substring_(this.text_, start, this.text_.length);
  }
  return this.substring_(this.text_, start, this.position_ - 1);
};

/**
@return {string}
*/
sce.gapi.utils_.LineReader.prototype.getRemainder = function() {
  return this.text_.substr(this.position_);
};

// *************************************************************************
// Class sce.gapi.Token

/**
@constructor
*/
sce.gapi.Token = function() {};

/** @public {string} */
sce.gapi.Token.prototype.access_token;

/** @public {string} */
sce.gapi.Token.prototype.error;

/** @public {string} */
sce.gapi.Token.prototype.expires_in;

/** @public {string} */
sce.gapi.Token.prototype.state;

// *************************************************************************
// Class sce.gapi.HttpRequest

/**
@typedef {{path:string,
           method: string,
           headers: Object.<string, string>,
           params: Array.<{key: string, value: string}>,
           body: string}}
 */
sce.gapi.HttpRequestArgs;

/**
@typedef {{status: number,
           statusText: string,
           headers: Object.<string, string>,
           body: string}}
 
*/
sce.gapi.HttpResponse;

/**
@param {sce.gapi.HttpRequestArgs} args
@constructor
@extends {swby.promise.LazyPromise}
*/
sce.gapi.HttpRequest = function(args) {
  swby.promise.LazyPromise.call(this, this.send_);
  this.path = args.path;
  this.method = args.method || 'GET';
  this.headers = args.headers || {};
  this.params = args.params || [];
  this.body = args.body || null;
};
swby.lang.inherits(sce.gapi.HttpRequest, swby.promise.LazyPromise);

/**
@return {string}
*/
sce.gapi.HttpRequest.prototype.getUrl = function() {
  return sce.gapi.x.rewriteUrl_(sce.gapi.utils_.buildUrl(this.path, this.params));
};

/**
@param {sce.gapi.HttpResponse} response
@return {boolean}
 */
sce.gapi.HttpRequest.prototype.isSuccess = function(response) {
  return response.status >= 200 & response.status < 300;
};

/**
@param {sce.gapi.HttpResponse} response
@return {sce.gapi.HttpResponse}
 */
sce.gapi.HttpRequest.prototype.createResponse_ = function(response) {
  return response;
};

/**
@return {string}
*/
sce.gapi.HttpRequest.prototype.getBody_ = function() {
  return this.body;
};

sce.gapi.HttpRequest.prototype.send_ = function(fulfill, reject) {
  var zhis = this;
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      var response = zhis.createResponse_({
          body: xhr.responseText,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: sce.gapi.utils_.parseResponseHeaders(xhr.getAllResponseHeaders())          
      });
      (zhis.isSuccess(response) ? fulfill : reject)(response);
    }
  };
  xhr.open(this.method, this.getUrl());
  if (this.headers) {
    for (var name in this.headers) {
      xhr.setRequestHeader(name, this.headers[name]);
    }
  }
  xhr.send(this.getBody_());  
};

// *************************************************************************
// Class sce.gapi.Request

/**
@param {sce.gapi.HttpRequestArgs} args
@constructor
@extends {sce.gapi.HttpRequest}
*/
sce.gapi.Request = function(args) {
  sce.gapi.HttpRequest.call(this, args);
};
swby.lang.inherits(sce.gapi.Request, sce.gapi.HttpRequest);

sce.gapi.Request.prototype.createResponse_ = function(response) {
  try {
    response.result = response.body ? JSON.parse(response.body) : null;
  } catch (e) {
    response.result = {
        error: {
          'message': 'Cannot parse response as JSON',
          'code': 503,
          'errors': [
            {
              'domain': 'global',
              'reason': 'backendError',
              'message': 'My Exception'
            }
          ]
        }
    };
    response.status = 503;
    response.statusText = 'Cannot parse response as JSON';
  }
  return response;
};

/**
@param {function(Object|boolean, string)} callback
*/
sce.gapi.Request.prototype.execute = function(callback) {
  this.then(function(response) {
    var response1 = {result: response.result};
    if (response.result) {
      for (var key in response.result) response1[key] = response.result[key];
    }
    callback(response1, JSON.stringify([{id: 'gapiRpc', result: response1.result}]));
  }, function(response) {
    var response1 = {
        code: response.result.error.code,
        data: response.result.error.errors,
        message: response.result.error.message,
        error: {
          code: response.result.error.code,
          data: response.result.error.errors,
          message: response.result.error.message
        }
    };
    callback(response1, JSON.stringify([{id: 'gapiRpc', error: response1.error}]));
  });
};

// *************************************************************************
// sce.gapi.impl_

swby.lang.namespace('sce.gapi.impl_');

/**
@param {*} obj
@param {string} path
@param {*} value
 */
sce.gapi.impl_.setPath = function(obj, path, value) {
  var parts = path.split('.');
  swby.lang.assert(parts.length > 0);
  for (var i = 0; i < parts.length - 1; ++i) {
    var next = obj[parts[i]];
    if (!next) {
      next = {};
      obj[parts[i]] = next;
    }
    obj = next;
  }
  obj[parts[parts.length - 1]] = value;
};

/**
@param {RestDescription} parameterDesc
@param {*} value
@return {string}
 */
sce.gapi.impl_.serializeParameter = function(parameterDesc, value) {
  return value + '';
};

/**
@param {RestDescription} parameterDesc
@param {*} value
@return {string}
 */
sce.gapi.impl_.serializeParameterInPath = function(parameterDesc, value) {
  if (parameterDesc.repeated) {
    return sce.gapi.utils_.map(function(element) {
      return sce.gapi.impl_.serializeParameter(parameterDesc, element);
    }, value).join(',');
  } else {
    return sce.gapi.impl_.serializeParameter(parameterDesc, value);
  }
};

/**
@param {string} path
@param {Object.<string, RestDescription>} parameterDescs
@param {Object.<string, *>} params 
 */
sce.gapi.impl_.getPath = function(path, parameterDescs, params) {
  var result = [];
  if (path.charAt(0) == '/') path = path.substr(1);
  path.split('/').forEach(function(fragment) {
    if (fragment.charAt(0) == '{' && fragment.charAt(fragment.length - 1) == '}') {
      var name = fragment.substr(1, fragment.length - 2);
      if (name.charAt(0) == '+') {
        name = name.substr(1);
      }
      var parameterDesc = parameterDescs[name];
      if (!parameterDesc) throw 'Unknown parameter in path: ' + name;
      if (!(name in params)) throw 'Required path parameter ' + name + ' is missing.';
      fragment = sce.gapi.impl_.serializeParameterInPath(parameterDesc, params[name]);
    }
    result.push(fragment);
  });
  return result.join('/');
};

/**
@param {Object.<string, RestDescription>} parameterDescs
@param {Object.<string, *>} params
@return {Array.<{key: string, value: string}>} 
*/
sce.gapi.impl_.getQueryParameters = function(parameterDescs, params) {
  var result = [];
  for (var name in parameterDescs) {
    var parameterDesc = parameterDescs[name];
    if (parameterDesc.location == 'query') {
      if (parameterDesc.repeated) {
        Array.prototype.push.apply(result, sce.gapi.utils_.map(function(value) {
          return {key: name, value: sce.gapi.impl_.serializeParameter(parameterDesc, value)};
        }, params[name] || []));
      } else {
        if (name in params) {
          result.push({key: name, value: sce.gapi.impl_.serializeParameter(parameterDesc, params[name])});
        }
      }
    }
  }
  if (sce.gapi.impl_.key) result.push({key: 'key', value: sce.gapi.impl_.key});
  return result;
};

/**
@param {string} baseUrl
@param {Object.<string, Schema>} schemas
@param {RestDescription} desc
@return {Array.<string>}
*/
sce.gapi.impl_.getRequestFields = function(schemas, desc) {
  var result = [];
  if (schemas && desc.request) {
    var schema = schemas[desc.request['$ref']];
    if (schema && schema.properties) {
      for (var propertyName in schema.properties) {
        result.push(propertyName);
      }
    }
  }
  return result;
};

/**
@param {string} baseUrl
@param {Object.<string, Schema>} schemas
@param {RestDescription} desc
@return {function()}
*/
sce.gapi.impl_.buildMethod = function(baseUrl, schemas, desc) {
  var requestProperties = sce.gapi.impl_.getRequestFields(schemas, desc);
  return function(params) {
    var headers = {'content-type': 'application/json'};
    if (sce.gapi.impl_.token) headers['authorization'] = 'Bearer ' + sce.gapi.impl_.token.access_token;
    return new sce.gapi.Request({
      path: baseUrl + sce.gapi.impl_.getPath(desc.path, desc.parameters, params),
      method: desc.httpMethod,
      headers: headers,
      params: sce.gapi.impl_.getQueryParameters(desc.parameters, params),
      body: desc.httpMethod == 'GET' ? '' : JSON.stringify(sce.gapi.utils_.clone(params, requestProperties))
    });
  };
};

/**
@param {RestDescription} desc
@param {Object} api
@param {Object.<string, MethodDesc>} methods
*/
sce.gapi.impl_.addMethods = function(desc, api, methods) {
  for (var methodName in methods) {
    var methodDesc = methods[methodName];
    sce.gapi.impl_.setPath(api, methodName, sce.gapi.impl_.buildMethod(desc.baseUrl, desc.schemas, methodDesc));
  }  
};

/**
 @param {RestDescription} desc
 @return {Api}
 */
sce.gapi.impl_.buildApi = function(desc) {
  var api = {};
  sce.gapi.impl_.addMethods(desc, api, desc.methods);
  for (var name in desc.resources) {
    var subapi = {};
    api[name] = subapi;
    sce.gapi.impl_.addMethods(desc, subapi, desc.resources[name].methods);
  }
  return api;
};

// *************************************************************************
// Class sce.gapi.MultipartRequest

/**
@param {sce.gapi.HttpRequestArgs} args
@constructor
@extends {sce.gapi.HttpRequest}
*/
sce.gapi.MultipleHttpRequest = function(args) {
  /** @private {Array.<{id: string, request: sce.gapi.HttpRequest}>} */
  this.parts_ = [];
  /** @private {string} */
  this.boundary_ = '--------------------------------------------------------------------------------' + (new Date).getTime();

  var headers = sce.gapi.utils_.clone(args.headers);
  headers['Content-Type'] = 'multipart/mixed; boundary=' + this.boundary_;
  sce.gapi.HttpRequest.call(this, {
    path: args.path,
    method: 'POST',
    headers: headers,
    params: args.params,
    body: null
  });
};
swby.lang.inherits(sce.gapi.MultipleHttpRequest, sce.gapi.HttpRequest);

/**
@param {sce.gapi.HttpRequest} request
@param {{id: string}=} opt_args
*/
sce.gapi.MultipleHttpRequest.prototype.add = function(request, opt_args) {
  this.parts_.push({
    id: opt_args && opt_args.id ? opt_args.id : (this.parts_.length + 1), 
    request: request
  });
};

/**
@return {string}
*/
sce.gapi.MultipleHttpRequest.prototype.getBody_ = function() {
  var body = [];
  this.parts_.forEach(function(part, index) {
    body.push('--' + this.boundary_);
    body.push('content-type: application/http');
    body.push('content-id: <' + part.id + '>');
    body.push('content-transfer-encoding: binary');
    body.push('');
    body.push(part.request.method + ' ' + part.request.getUrl());
    for (var key in part.request.headers) {
      body.push(key + ': ' + part.request.headers[key]);
    }
    body.push('');
    body.push(part.request.getBody_());
  }, this);
  body.push('--' + this.boundary_ + '--');
  return body.join('\n');
};

/**
@param {string} contentType
@return {string}
*/
sce.gapi.MultipleHttpRequest.prototype.getBoundary_ = function(contentType) {
  var prefix = 'multipart/mixed; boundary=';
  if (!contentType || contentType.substr(0, prefix.length) != prefix) {
    throw 'Unexpected content type: "' + contentType + '"';
  }
  return contentType.substr(prefix.length);
};

/**
@param {string} contentId
@return {string}
*/
sce.gapi.MultipleHttpRequest.prototype.parseContentId_ = function(contentId) {
  if (!contentId || contentId.substr(0, 10) != '<response-' || contentId.charAt(contentId.length - 1) != '>')
    throw 'Cannot parse content ID: "' + contentId + '"';
  return contentId.substr(10, contentId.length - 11);
};

/**
@param {sce.gapi.HttpResponse} response
*/
sce.gapi.MultipleHttpRequest.prototype.parseMultipart_ = function(response) {
  var boundary = this.getBoundary_(response.headers['content-type']);
  var parts = response.body.split('--' + boundary);
  // Ignoring the first part, as the multipart starts by a boundary
  // Ignoring the last part, as the multipart body is terminated by '--'
  parts = parts.slice(1, parts.length - 1);
  var result = {};
  parts.forEach(function(body) {
    if (body.substr(0, 2) == '\r\n') body = body.substr(2);
    else if (body.substr(0, 1) == '\n') body = body.substr(1);
    var response = {
        headers: {},
        partHeaders: {}
    };
    var reader = new sce.gapi.utils_.LineReader(body);
    
    // Part headers
    while (true) {
      var line = reader.getLine();
      if (!line) break;
      sce.gapi.utils_.parseResponseHeader(response.partHeaders, line);
    }
    
    // HTTP response
    var line = reader.getLine();
    var splittedLine = line.split(' ', 2);
    if (line.substr(0, 4) != 'HTTP' || splittedLine.length < 2) throw 'Malformed HTTP response: ' + line;
    response.status = parseInt(splittedLine[1], 10);
    response.statusText = line.substr(splittedLine[0].length + splittedLine[1].length + 2);
    
    // Headers
    while (true) {
      var line = reader.getLine();
      if (!line) break;
      sce.gapi.utils_.parseResponseHeader(response.headers, line);
    }
    
    // Body
    response.body = reader.getRemainder();

    result[this.parseContentId_(response.partHeaders['content-id'])] = response;
  }, this);
  return result;
};

sce.gapi.MultipleHttpRequest.prototype.createResponse_ = function(response) {
  try {
    response.result = this.parseMultipart_(response);
    this.parts_.forEach(function(part) {
      var result = response.result[part.id];
      if (result) {
        response.result[part.id] = part.request.createResponse_(result);
        (this.isSuccess(result.status) ? part.request.forceFulfill : part.request.forceReject)(result);
      }
    }, this);
  } catch (e) {
    response.result = {
        error: {
          'message': 'Cannot parse multipart response',
          'code': 503,
          'errors': [
            {
              'domain': 'global',
              'reason': 'backendError',
              'message': 'My Exception'
            }
          ]
        }
    };
    response.status = 503;
    response.statusText = 'Cannot parse multipart response';
  }
  return response;
};

// *************************************************************************
// Class sce.gapi.Batch

/**
@constructor
@extends {swby.promise.Promise}
*/
sce.gapi.Batch = function() {
  sce.gapi.MultipleHttpRequest.call(this, {
    path: 'https://www.googleapis.com/batch',
    method: 'POST',
    headers: {},
    params: []
  });
};
swby.lang.inherits(sce.gapi.Batch, sce.gapi.MultipleHttpRequest);

/**
@param {function(Object.<string, Object|boolean>, Object.<string, string>)} callback
*/
sce.gapi.Batch.prototype.execute = function(callback) {
  this.then(function(response) {
    var response1 = {};
    for (var id in response.result) {
      var result = response.result[id];
      response1[id] = {
          id: id,
          result: result.result,
          error: (result.error ? {
            code: result.error.code,
            message: result.error.message,
            data: result.error.errors
          } : undefined)
      }
    }
    callback(response1);
  }, function(response) {
    // TODO
  });
};

// *************************************************************************
// sce.gapi.auth

swby.lang.namespace('sce.gapi.auth');

/** @private {sce.gapi.Token} */
sce.gapi.impl_.token = null;

/**
@param {{client_id: (string|undefined),
         immediate: (boolean|undefined),
         response_type: (string|undefined),
         scope: (string|Array.<string>)}} params
@param {function(sce.gapi.Token)} callback
*/
sce.gapi.auth.authorize = function(params, callback) {
  sce.gapi.impl_.token = {
    access_token: 'sce_access_token',
    expires_in: '3600',
    state: typeof params.scope == 'string' ? params.scope : params.scope.join(' ')
  };
  callback({});
};

/**
@param {function()} callback
*/
sce.gapi.auth.init = function(callback) {
  sce.gapi.auth.authorize({immediate: true}, callback);
};

/**
@return {sce.gapi.Token}
*/
sce.gapi.auth.getToken = function() {
  return sce.gapi.impl_.token;
};

/**
@param {sce.gapi.Token} token
*/
sce.gapi.auth.setToken = function(token) {
  sce.gapi.impl_.token = token;
};

// *************************************************************************
// sce.gapi.client

swby.lang.namespace('sce.gapi.client');

/**
@param {string} name
@param {string} version
@param {function()=} opt_callback
@param {string=} opt_root
@return {swby.promise.Promise}
*/
sce.gapi.client.load = function(name, version, opt_callback, opt_root) {
  var root = opt_root || 'https://www.googleapis.com/';
  var promise = new sce.gapi.Request({
    path: root + '/discovery/v1/apis/' + name + '/' + version + '/rest',
    method: 'GET'
  }).then(function(response) {
    sce.gapi.client[name] = sce.gapi.impl_.buildApi(response.result);
    if (opt_callback) opt_callback();
  }, function(response) {
    if (opt_callback) opt_callback(response.result);
    return response.result;
  });
  if (!opt_callback) return promise;
};

/**
@param {{path:string,
         method: (string|undefined),
         params: Object.<string, string>,
         headers: Object.<string, string>,
         body: (string|Object)}} args
@return {sce.gapi.client.Request}
*/
sce.gapi.client.request = function (args) {
  return new sce.gapi.Request(args);
};

/**
@return {sce.gapi.client.Batch}
*/
sce.gapi.client.newBatch = function() {
  return new sce.gapi.Batch();
};

/** @private {string} */
sce.gapi.impl_.key = null;

/**
@param {string} key
*/
sce.gapi.client.setApiKey = function(key) {
  sce.gapi.impl_.key = key;  
};
