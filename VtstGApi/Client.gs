var gapi = {};

/**
@param {function(this: CONTEXT, T): S} fn
@param {Array.<T>} arr
@param {CONTEXT?} opt_context
@return {Array.<S>}
 */
gapi.map_ = function(fn, arr, opt_context) {
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
gapi.mapDict_ = function(fn, obj, opt_context) {
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
gapi.buildUrlComponent_ = function(entry) {
  return encodeURIComponent(entry.key) + '=' + encodeURIComponent(entry.value);
};

/**
@param {string} path
@param {(Array.<{key: string, value: string}>|Object.<string, string>)=} opt_params
@return {string}
*/
gapi.buildUrl_ = function(path, opt_params) {
  var url = path;
  if (opt_params) {
    if (opt_params instanceof Array) {
      var params = gapi.map_(gapi.buildUrlComponent_, opt_params);
    } else {
      var params = gapi.mapDict_(gapi.buildUrlComponent_, opt_params);      
    }
    if (params.length > 0) url += '?' + params.join('&');      
  }
  return url;
};

/**
@param {string} headers
@return {Object.<string, string>}
 */
// TODO: Fix case differences
gapi.parseResponseHeaders_ = function(str) {
  var headers = {};
  if (str) {
    str.split('\u000d\u000a').forEach(function(line) {
      var i = line.indexOf('\u003a\u0020');
      if (i > 0) headers[line.substring(0, i)] = line.substring(i + 2);
    });
  }
  return headers;
}

// *************************************************************************
// Class gapi.Token

/**
@constructor
*/
gapi.Token = function() {};

/** @public {string} */
gapi.Token.prototype.access_token;

/** @public {string} */
gapi.Token.prototype.error;

/** @public {string} */
gapi.Token.prototype.expires_in;

/** @public {string} */
gapi.Token.prototype.state;

// *************************************************************************
// Class gapi.Request

/**
@constructor
@extends {swby.promise.Promise}
@template VALUE, REASON
*/
gapi.Request = function() {
  swby.promise.LazyPromise.call(this, this.execute_, this);
};
//swby.lang.inherits(gapi.Request, swby.promise.LazyPromise);

/**
@param {function(VALUE)} fulfill
@param {function(REASON)} reject
@protected @abstract
*/
gapi.Request.prototype.execute_ = function(fulfill, reject) {};

/**
@param {function(Object|boolean, string)} callback
*/
gapi.Request.prototype.execute = function(callback) {
  this.execute_(function(response) {
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
// request

/**
typedef {{path:string,
          method: (string|undefined),
          params: (Array.<{key: string, value: string}>|Object.<string, string>),
          headers: Object.<string, string>,
          body: (string|Object)}} args
 */
gapi.XhrApiRequestArgs;

/**
@param {gapi.XhrApiRequestArgs}
@param {Response}
*/
gapi.request_ = function(args) {
  var url = gapi.buildUrl_(args.path, args.params);
  var response = UrlFetchApp.fetch(url, {
    method: args.method || 'GET',
    headers: args.headers,
    payload: args.body,
    muteHttpExceptions: true
  });
  
  try {
    var result = JSON.parse(response.getContentText());
    var status = response.getResponseCode();
    var statusText = 'Response code ' + response.getResponseCode();
  } catch (e) {
    var result = {
      error: {
        "message": "Cannot parse response as JSON",
        "code": 503,
        "errors": [
          {
            "domain": "global",
            "reason": "backendError",
            "message": "My Exception"
          }
        ]
      }
    };
    var status = 503;
    var statusText = 'Cannot parse response as JSON';
  }
  
  return {
    success: status == 200,
    error: status != 200,
    body: response.getContentText(),
    status: status,
    statusText: statusText,
    result: result,
    headers: response.getAllHeaders()
  };
};

// *************************************************************************
// gapi.internal_

gapi.internal_ = {};

/**
@param {*} obj
@param {string} path
@param {*} value
 */
gapi.internal_.setPath = function(obj, path, value) {
  var parts = path.split('.');
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
gapi.internal_.serializeParameter = function(parameterDesc, value) {
  return value + '';
};

/**
@param {RestDescription} parameterDesc
@param {*} value
@return {string}
 */
gapi.internal_.serializeParameterInPath = function(parameterDesc, value) {
  if (parameterDesc.repeated) {
    return gapi.map_(function(element) {
      return gapi.internal_.serializeParameter(parameterDesc, element);
    }, value).join(',');
  } else {
    return gapi.internal_.serializeParameter(parameterDesc, value);
  }
};

/**
@param {string} path
@param {Object.<string, RestDescription>} parameterDescs
@param {Object.<string, *>} params 
 */
gapi.internal_.getPath = function(path, parameterDescs, params) {
  var result = [];
  if (path.charAt(0) == '/') path = path.substr(1);
  path.split('/').forEach(function(fragment) {
    if (fragment.charAt(0) == '{' && fragment.charAt(fragment.length - 1) == '}') {
      var name = fragment.substr(1, fragment.length - 2);
      var parameterDesc = parameterDescs[name];
      if (!parameterDesc) throw 'Unknown parameter in path: ' + name;
      if (!(name in params)) throw 'Required path parameter ' + name + ' is missing.';
      fragment = gapi.internal_.serializeParameterInPath(parameterDesc, params[name]);
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
gapi.internal_.getQueryParameters = function(parameterDescs, params) {
  var result = [];
  for (var name in parameterDescs) {
    var parameterDesc = parameterDescs[name];
    if (parameterDesc.location == 'query') {
      if (parameterDesc.repeated) {
        Array.prototype.push.apply(result, gapi.map_(function(value) {
          return {key: name, value: gapi.internal_.serializeParameter(parameterDesc, value)};
        }, params[name]));
      } else {
        if (name in params) {
          result.push({key: name, value: gapi.internal_.serializeParameter(parameterDesc, params[name])});
        }
      }
    }
  }
  return result;
};

/**
@param {RestDescription} desc
@return {function()}
*/
gapi.internal_.buildMethod = function(baseUrl, desc) {
  if (!gapi.internal_.token) 'No OAuth2 token. Call gapi.auth.authorize first.';
  // TODO: Stringify only relevant fields from params
  return function(params) {
    return gapi.request_({
      path: baseUrl + gapi.internal_.getPath(desc.path, desc.parameters, params),
      method: desc.httpMethod,
      headers: {
        'Content-type': 'application/json',
        'Authorization': 'Bearer ' + gapi.internal_.token.access_token
      },
      params: gapi.internal_.getQueryParameters(desc.parameters, params),
      body: JSON.stringify(params)
    });
  };
};

/**
 @param {RestDescription} desc
 @return {Api}
 */
gapi.internal_.buildApi = function(desc) {
  var api = {};
  for (var methodName in desc.methods) {
    var methodDesc = desc.methods[methodName];
    gapi.internal_.setPath(api, methodName, gapi.internal_.buildMethod(desc.baseUrl, methodDesc));
  }
  for (var name in desc.resources) {
    var resourceDesc = desc.resources[name];
    var subapi = {};
    api[name] = subapi;
    for (var methodName in resourceDesc.methods) {
      var methodDesc = resourceDesc.methods[methodName];
      gapi.internal_.setPath(subapi, methodName, gapi.internal_.buildMethod(desc.baseUrl, methodDesc));
    }
  }
  return api;
};

// *************************************************************************
// gapi.auth

gapi.auth = {};

/** @private {gapi.Token} */
gapi.internal_.token = null;

/** @const {string} */
gapi.internal_.SERVICE_NAME = 'vtst-gapi';

/**
@param {{client_id: (string|undefined),
         client_secret: (string|undefined),
         immediate: (boolean|undefined),
         response_type: (string|undefined),
         scope: (string|Array.<string>)}} params
@return {Service_}
*/
gapi.auth.createService_ = function(params) {
  var service = OAuth2_.createService(gapi.internal_.SERVICE_NAME)
      .setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/auth')
      .setTokenUrl('https://accounts.google.com/o/oauth2/token')
      .setParam('login_hint', Session.getActiveUser().getEmail())
      .setParam('access_type', 'offline')
      .setPropertyStore(PropertiesService.getUserProperties());
  if (params) {
    service.setClientId(params.client_id || '')
        .setClientSecret(params.client_secret || '')
        .setScope(params.scope);
  }
  return service;
};

/**
@param {{client_id: (string|undefined),
         client_secret: (string|undefined),
         scope: (string|Array.<string>)}} params
@param {string} callbackName
@return {string}  Authorization URL if not authorized
*/
gapi.auth.authorize = function(params, callbackName) {
  var service = gapi.auth.createService_(params)
      .setCallbackFunction(callbackName);
  if (service.hasAccess()) {
    gapi.internal_.token = {
      access_token: service.getAccessToken()
    };
    return null;
  } else {
    return service.getAuthorizationUrl();
  }
};

/**
@param {{client_id: (string|undefined),
         client_secret: (string|undefined),
         immediate: (boolean|undefined),
         response_type: (string|undefined),
         scope: (string|Array.<string>)}} params
@param {string} callbackName
*/
gapi.auth.authorizeOrFail = function(params, callbackName) {
  var authorizationUrl = gapi.auth.authorize(params, callbackName);
  if (authorizationUrl) {
    Logger.log(
      'To authorize access, copy and paste this URL:\n\n' +
      authorizationUrl +
      '\n\nand run again the script.');
    throw 'Authorization needed. See log by typing Ctrl+Enter.';
  }
};

/**
@param {{client_id: (string|undefined),
         client_secret: (string|undefined),
         immediate: (boolean|undefined),
         response_type: (string|undefined),
         scope: (string|Array.<string>)}} params
@param {Request} request
*/
gapi.auth.callback = function(params, request) {
  var isAuthorized = gapi.auth.createService_(params).handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput('Success! You can close this tab.');
  } else {
    return HtmlService.createHtmlOutput('Denied. You can close this tab');
  }
};

/**
@return {string}
*/
gapi.auth.getRedirectUri = function() {
  return OAuth2_.getRedirectUri(eval('Script' + 'App').getProjectKey());
}

/**
@return {gapi.Token}
*/
gapi.auth.getToken = function() {
  return gapi.internal_.token;
};

/**
@param {gapi.Token} token
*/
gapi.auth.setToken = function(token) {
  gapi.internal_.token = token;
};

gapi.auth.clear = function() {
  gapi.auth.createService_().reset();
};

// *************************************************************************
// gapi.client

gapi.client = {};

/**
@param {string} name
@param {string} version
@param {string=} opt_root
@return {Api}
*/
gapi.client.load = function(name, version, opt_root) {
  var root = opt_root || 'https://www.googleapis.com/';
  var response = gapi.request_({
    path: root + '/discovery/v1/apis/' + name + '/' + version + '/rest',
    method: 'GET'
  });
  if (response.success) {
    var api = gapi.internal_.buildApi(response.result);
    gapi.client[name] = api;
    return api;
  } else {
    return null;
  }
};

/**
@param {string} name
@param {string} version
@param {string=} opt_root
@return {Api}
*/
gapi.client.loadOrFail = function(name, version, opt_root) {
  var api = gapi.client.load(name, version, opt_root);
  if (!api) throw 'Cannot load API: ' + name + ' (' + version + ')';
  return api;
};

/**
@param {{path:string,
         method: (string|undefined),
         params: Object.<string, string>,
         headers: Object.<string, string>,
         body: (string|Object)}} args
@return {Response}
*/
gapi.client.request = function(args) {
  return gapi.request_(args);
};
