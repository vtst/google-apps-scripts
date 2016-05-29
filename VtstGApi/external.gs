function setTimeout(fn, t) {
  fn();
}

// *************************************************************************
// Client

swby.promise.Promise.prototype.call = function() {
  var response = null;
  this.then(function(value) {
    response = value;
  }, function(err) {
    throw err;
  });
  return response;
};

sce.gapi.Request.prototype.call = swby.promise.Promise.prototype.call;
sce.gapi.Batch.prototype.call = sce.gapi.Request.prototype.call;

sce.gapi.HttpRequest.prototype.send_ = function(fulfill, request) {
  var fetchResponse = UrlFetchApp.fetch(this.getUrl(), {
    method: this.method,
    headers: this.headers,
    payload: this.getBody_(),
    muteHttpExceptions: true
  });
  var response = this.createResponse_({
    body: fetchResponse.getContentText(),
    status: fetchResponse.getResponseCode(),
    statusText: 'Response ' + fetchResponse.getResponseCode(),
    headers: fetchResponse.getAllHeaders()
  });
  (this.isSuccess(response) ? fulfill : reject)(response);
};

var client = sce.gapi.client;

// *************************************************************************
// Auth

var auth = {};

/** @const {string} */
auth.SERVICE_NAME_ = 'vtst-gapi';

/**
@param {{client_id: (string|undefined),
         client_secret: (string|undefined),
         immediate: (boolean|undefined),
         response_type: (string|undefined),
         scope: (string|Array.<string>)}} params
@return {Service_}
*/
auth.createService_ = function(params) {
  var service = OAuth2_.createService(auth.SERVICE_NAME_)
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
         response_type: (string|undefined),
         scope: (string|Array.<string>)}} params
@param {string} callbackName
*/
auth.authorize = function(params, callbackName) {
  var service = auth.createService_(params).setCallbackFunction(callbackName);
  if (service.hasAccess()) {
    sce.gapi.impl_.token = {
      access_token: service.getAccessToken()
    };
    return null;
  } else {
    return service.getAuthorizationUrl();
  }
};

auth.init = function() {
  auth.authorize({});
};

/**
@param {{client_id: (string|undefined),
         client_secret: (string|undefined),
         immediate: (boolean|undefined),
         response_type: (string|undefined),
         scope: (string|Array.<string>)}} params
@param {string} callbackName
*/
auth.authorizeOrFail = function(params, callbackName) {
  var authorizationUrl = auth.authorize(params, callbackName);
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
auth.callback = function(params, request) {
  var isAuthorized = auth.createService_(params).handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput('Success! You can close this tab.');
  } else {
    return HtmlService.createHtmlOutput('Denied. You can close this tab');
  }
};

/**
@return {string}
*/
auth.getRedirectUri = function() {
  return OAuth2_.getRedirectUri(eval('Script' + 'App').getProjectKey());
};

/**
@return {sce.gapi.Token} token
*/
auth.getToken = sce.gapi.auth.getToken;

/**
@param {sce.gapi.Token} token
*/
auth.setToken = sce.gapi.auth.setToken;
