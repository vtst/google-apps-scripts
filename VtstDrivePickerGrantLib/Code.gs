function includeComponent() {
  return HtmlService.createTemplateFromFile('Component').evaluate().getContent();
}

function _getUi() {
  try {
    return SpreadsheetApp.getUi();
  } catch {
    return DocumentApp.getUi();
  }
}

function hasAccessToFile(fileId) {
  try {
    Drive.Files.get(fileId, { fields: 'id' });
    return true;
  } catch {
    return false;
  }
}

function grantFileAccess(global, options, fileIds, continuationFn) {
  const continuationFnArguments = Array.prototype.slice.call(arguments, 3);
  if (typeof fileIds === 'string') fieleIds = [fileIds];
  const filteredFileIds = fileIds.filter(id => !hasAccessToFile(id));
  if (filteredFileIds.length > 0) {
    let template = HtmlService.createTemplateFromFile('Dialog');
    template.data = {
      continuationFn: continuationFn,
      continuationFnArguments: continuationFnArguments,
      fileIds: fileIds,
      options: options || {}
    };
    const title = options.title || ' ';
    const html = template.evaluate().setTitle(title).setWidth(options.width || 600).setHeight(options.height || 400);
    _getUi().showModalDialog(html, title);
  } else {
    global[continuationFn].apply(null, [[], ...continuationFnArguments]);
  }
}
