var OAUTH_PARAMS_ = {
    client_id: '1060055680355-u8lqvk0ob47oj1ttmrmohkn6om9qvaee.apps.googleusercontent.com',
    client_secret: 'JCXG3iuivPpymLB1m7r5qxRB',
    scope: 'https://www.googleapis.com/auth/drive'
  };

function clear_() {
  gapi.auth.clear();
}

function gapiCallback_(request) {
  return gapi.auth.callback(OAUTH_PARAMS_, request);
}

function test_() {
  gapi.auth.authorizeOrFail(OAUTH_PARAMS_, 'gapiCallback')
  gapi.client.load('drive', 'v2');
  var list = gapi.client.drive.files.list({
    'pageSize': 10
  });
  Logger.log(list);
}
