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

If the API you want to use does not require OAuth 2.0 authentication (this is in general the
case for APIs which do not manipulate user data, like the [URL Shortener API](https://developers.google.com/url-shortener/)),
you can follow the instructions in this section.

#### Setting up your project

In this section, you will set up your project in order to get an API key. If the API you
want to use does not require an API key, you can skip this section

* In the Google Apps Script Editor, select _Resources_ then _Developers Console Project_ in the menu.
* In the dialog _Developers Console Project_, click on the link below _This script is currently associated with project:_
  to open the Google API Console.
* In the _Google API Console_, select the API you want to use (e.g. _Google Drive API_).
* On the API page, click on _Enable_.
* In the navigation menu on the left hand side, click on _Credentials_.
* Click on _Create credentials_ and then _API key_.
* In the dialog, click on _Server key_.
* Fill the name you like for the key, leave the field _Accept requests from these server IP addresses_ empty
  and click on _Create_.
* Copy the API key into your Google Apps Script code.

#### Implementing code

Then, you can call the API as follows:

    function testShort() {
      gapi.client.load('urlshortener', 'v1');
      gapi.client.setApiKey('[...]');
      var response = gapi.client.urlshortener.url.insert({
        longUrl: 'http://your-long-url.com'
      });
      Logger.log(JSON.stringify(response, null, 2));
    }

### Calling an API with OAuth 2.0 authentication

If the API you want to use requires OAuth 2.0 authentication (this is in general the
case for APIs which manipulate user data, like the [Google Drive API](https://developers.google.com/drive/v3/web/about-sdk)),
you can follow the instructions in this section.

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
      gapi.client.load('drive', 'v2').call();
      var response = gapi.client.drive.files.list({
        'pageSize': 10
      }).call();
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

### Batch requests

Batch requests are supported as well.  Here is an example:

    gapi.client.load('urlshortener', 'v1').call();
    gapi.client.setApiKey('AIzaSyDeBPZPMs4nnI1Vn0mUGTXPWEO6I9wA2mc');
    var batch = gapi.client.newBatch();
    batch.add(client.urlshortener.url.insert({
      longUrl: 'http://your-first-long-url.com'
    }));
    batch.add(client.urlshortener.url.insert({
      longUrl: 'http://your-second-long-url.com'
    }));
    var response = batch.call();
    Logger.log(JSON.stringify(response, null, 2));

### A note about promises

The functions `gapi.client.load` and `gapi.client.request`, as well as all API
requests return asynchronouse promises (in the same way as the
[API Client Library for JavaScript](https://developers.google.com/api-client-library/javascript/start/start-js).

One can use the `then` method of promises as in JavaScript:

    client.urlshortener.url.insert({
      longUrl: 'http://your-second-long-url.com'
    }).then(function(response) {
      ...
    }, function(error) {
      ...
    });
    
This allows to directly port JavaScript code to Google Apps Script.

However, Google Apps Script code is generally wrote in synchronous style. For this
purpose, the returned promises have an extra method `.call()`, which resolves the
promises and return the result value.  In case of error, this method raises an
exception.

    try {
      var response = client.urlshortener.url.insert({
        longUrl: 'http://your-second-long-url.com'
      }).call();
      ...
    } catch (error) {
      ...
    }

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

    gapi.client.setApiKey(key)
    
Sets the API key for the application. Some APIs require this to be set in order to work. 

    gapi.client.load(name, version, root)
    
Load an API.  The returned object is a promise, whose value is the loaded API.  The loaded
API is also added as a field naed `<name>` to the global object `gapi.client`
(e.g. `gapi.client.calendar`).

* `name` (string): the name of the API to load.
* `version` (string): the version of the API to load.
* `root` (optional string): the root URL of the API server. Leave empty for using public
  Google APIs.
* Return a promise whose value is the API, or `null` if loading failed.
    
    gapi.client.loadOrFail(name, version, root)
    
Load an API, similary to `gapi.client.load`, but throw an exception if loading
fails.
    
    gapi.client.request(args)
    
Send an HTTP request and return a promise.

* `args`: an object encapsulating the arguments for this method.  Fields are the
  following:
  * `path` (required, string): The URL for the request.
  * `method` (string): The HTTP method to use, `GET` by default.
  * `params` (Object): Dictionary of URL parameters.
  * `headers` (Object): Dictionary of additional HTTP heads. 

## License

This library is distributed under the terms of the [MIT license](../LICENSE).
