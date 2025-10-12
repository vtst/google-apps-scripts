let _REPORTER = null;
var CALLBACK_NAME = 'vtstRealtimeProgressLibCallback';

function includeProgressComponent() {
  return HtmlService.createHtmlOutputFromFile('ProgressComponent').getContent();
}

function callback(method, arg) {
  switch(method) {
    case 'run':
      let reporter = new _Reporter(arg.key, arg.pushIntervalInMs);
      try {
        let result = this[arg.functionName].apply(this, [reporter, ... arg.functionArguments]);
        reporter._end();
        return result;
      } catch (e) {
        reporter._end();
        throw e;        
      }
      break;
    case 'message':
      return PropertiesService.getUserProperties().getProperty(arg);
  }
}

function _getUi() {
  try {
    return SpreadsheetApp.getUi();
  } catch {
    return DocumentApp.getUi();
  }
}

function runWithProgressDialog(options, functionName/*, functionArguments*/) {
  const functionArguments = Array.prototype.slice.call(arguments, 2);
  const template = HtmlService.createTemplateFromFile('ProgressDialog');
  template.options = options;
  template.functionName = functionName;
  template.functionArguments = functionArguments;
  const html = template.evaluate().setWidth(400).setHeight(150);
  _getUi().showModalDialog(html, options.title || 'Please wait...');
}
