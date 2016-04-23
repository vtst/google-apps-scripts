# VtstGApi

A Google APIs client library for Google Apps Script.

© Vincent Simonet, 2016.

* * *

## Overview

This library is a generic [client to call Google APIs](https://developers.google.com/discovery/libraries)
(and Google Cloud Endpoints) in [Google Apps Script](https://developers.google.com/apps-script/).
It has a similar interface as the [API Client Library for JavaScript](https://developers.google.com/api-client-library/javascript/start/start-js)
with the notable difference that calls are synchronous, following the common model of
Google Apps Script libraries.  It implements the [OAuth 2.0](https://developers.google.com/identity/protocols/OAuth2)
protocol for authentication and authorization. 

## How to use in your project?

You may add the library in your Google Apps Script project following the procedure described
[here](https://developers.google.com/apps-script/guide_libraries).  The library project key is
`MVvDIVYrTbZmeRCTovQboz_YB2d3K7A2c`.  You should select the latest available version.

## Tutorial

### Calling an API without authentication

If you're using an API which does not require authentication, you can proceed as follows:

### Calling an API with OAuth 2.0 authentication

#### Setting up your project

Before setting up your project, you need to know the redirect URI it will use for the authentication process.
For this purpose, copy the following function in your Google Apps Script project:

    function logRedirectUri() {
      Logger.log(gapi.auth.getRedirectUri());
    }

and run it. Open the logs (menu _View_ then _Logs_) and copy the URI that appears in the log.

Once you have the redirect URI, you can configure your project as follows:

* In the Google Apps Script Editor, select _Resources_ then _Developers Console Project_ in the menu.
* In the dialog _Developers Console Project_, click on the link below _This script is currently associated with project:_
  to open the Google API Console.
* In the _Google API Console_, select the API you want to use (e.g. _Google Drive API_).
* On the API page, click on _Enable_.
* In the navigation menu on the left hand side, click on _Credentials_.
* Click on _Create credentials_ and then _OAuth Client ID_.
* Select _Web application_ as _Application type_, and add your redirect URI into _Authorized redirect URIs_.
* Click on _Create_. Copy the client ID and client secret into your Google Apps Script code.


#### Implementing code

Then, you can call the API as follows:

    var OAUTH_PARAMS_ = {
        client_id: '[...]',
        client_secret: '[...]',
        scope: 'https://www.googleapis.com/auth/drive'
    };
    
    function gapiCallback(request) {
        return gapi.auth.callback(OAUTH_PARAMS_, request);
    }
    
    function example() {
      gapi.auth.authorizeOrFail(OAUTH_PARAMS_, 'gapiCallback');
      gapi.client.load('drive', 'v2');
      var response = gapi.client.drive.files.list({
        'pageSize': 10
      });
      Logger.log(response);
    }
    
The function `gapi.auth.authorizeOrFail` will retrieve the authentication token.
If the user needs to grant some permission, the function writes a message including an URL
to the log and throw an exception.  The user needs to open the URL in his browser, follow
the authorization flow, and then run again the function.

If you would like to implement a custom authorization flow (e.g. if your application
has a proper front-end), you may instead use the method `gapi.auth.authorize`.  This
method returns `null` if authorization succeeded, and a string containing the URL for
authorization if some authorization is needed.

Every call to the API returns a `response` object, with boolean fields `success` and
`error` indicating the response status (`response.success == !response.error`).
In case of success, the result is given by the field `result`.

## Reference

### Authentification

    VtstGApi.auth.authorize(params, callbackName)
    
Initiate an OAuth2 authorization process.  Return null if authorization succeed.  If some
user approval is required, the function returns an URL that should be followed by the user
to initiate the approval process.  Once approval is granted, the function should be called
again (and will return `null`).

The authentication token is stored in the user properties so that it can be retrieved for
future calls.

* `params`: an object encapsulating the authentication parameters.  Fields are the
  following:
  * `client_id` (string): the client API.
  * `client_secret` (string): the client secret.
  * `scope` (string or array of strings): the used scopes.
* `callbackName` (string): the name of the callback function.
* Return `null` if authentication succeed, or a string containing the authentication URL
  if user authorization is needed.
    
    VtstGApi.auth.authorizeOrFail(params, callbackName)
    
Same as `VtstgApi.auth.authorize`, but throw an exception in the case user approval
is required.  The URL to be followed by the user is written to the log.
    
    VtstGApi.auth.getRedirectUri()
    
Get the redirect URI used in the authorization process.  This method is intended to be
called by the developer in order to configure the credentials in the Google Cloud Console.
It is not intended to be called in production code.
    
    VtstGApi.auth.getToken()
    
Get the OAuth2 authentication token.
    
    VtstGApi.auth.setToken(token)
    
Set the OAuth2 authentication token.
    
    VtstGApi.auth.clear()
    
Clear the authentication token stored by `VtstGApi.auth.authorize` in user properties.
    
### Client

    gapi.client.load(name, version, root)
    
Load an API.  The loaded API is returned by the method, and added as a field named
`<name>` of `gapi.client` (e.g. `gapi.client.calendar`).

* `name` (string): the name of the API to load.
* `version` (string): the version of the API to load.
* `root` (optional string): the root URL of the API server. Leave empty for using public
  Google APIs.
* Return the API module, or `null` if loading fails.
    
    gapi.client.loadOrFail(name, version, root)
    
Load an API, similary to `gapi.client.load`, but throw an exception if loading
fails.
    
    gapi.client.request(args)
    
Send an HTTP request and return a response object.

* `args`: an object encapsulating the arguments for this method.  Fields are the
  following:
  * `path` (required, string): The URL for the request.
  * `method` (string): The HTTP method to use, `GET` by default.
  * `params` (Object): Dictionary of URL parameters.
  * `headers` (Object): Dictionary of additional HTTP heads.

## License

This library is distributed under the terms of the [GNU LGPL, version 2.1](http://www.gnu.org/licenses/old-licenses/lgpl-2.1.html).