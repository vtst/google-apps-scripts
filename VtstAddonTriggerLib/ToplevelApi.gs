let _CONFIG = {... _DEFAULT_CONFIG};

/** Set the global configuration.
@param {Config} config
*/
function setConfig(config) {
  _CONFIG = {... _DEFAULT_CONFIG, ... config};
}

function _getTriggerManager(docId, docUrl) {
  return new TriggerManager(_CONFIG, docId, docUrl);
}

/**
Get the configuration for the currently active document.
@return {Config}
 */
function getConfigForActiveDocument() {
  // Using null as document ID because it's not used by getConfigForActiveDocument, though it's extremely hacky.
  return _getTriggerManager().getConfigForActiveDocument();
}

/**
Get the configuration for the currently active spreadsheet.
@return {Config}
 */
function getConfigForActiveSpreadsheet() {
  // Using null as document ID because it's not used by getConfigForActiveDocument, though it's extremely hacky.
  return _getTriggerManager().getConfigForActiveDocument();
}

/**
Set the configuration for the currently active document.
@param {Config} config
 */
function setConfigForActiveDocument(config) {
  const doc = DocumentApp.getActiveDocument()
  return _getTriggerManager(doc.getId(), doc.getUrl()).setConfigForActiveDocument(config);
}

/**
Set the configuration for the currently active spreadsheet.
@param {Config} config
 */
function setConfigForActiveSpreadsheet(config) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return _getTriggerManager(spreadsheet.getId(), spreadsheet.getUrl()).setConfigForActiveDocument(config);
}
