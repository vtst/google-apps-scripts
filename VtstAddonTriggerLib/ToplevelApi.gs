let _CONFIG = {... _DEFAULT_CONFIG};

/** Set the global configuration.
@param {Config} config
*/
function setConfig(config) {
  _CONFIG = {... _DEFAULT_CONFIG, ... config};
}

function _getTriggerManager(docId) {
  return new TriggerManager(_CONFIG, docId);
}

/**
Get the configuration for the currently active document.
@return {Config}
 */
function getConfigForActiveDocument() {
  // Using null as document ID because it's not used by getConfigForActiveDocument, though it's extremely hacky.
  return _getTriggerManager(null).getConfigForActiveDocument();
}

/**
Get the configuration for the currently active spreadsheet.
@return {Config}
 */
function getConfigForActiveSpreadsheet() {
  // Using null as document ID because it's not used by getConfigForActiveDocument, though it's extremely hacky.
  return _getTriggerManager(null).getConfigForActiveDocument();
}

/**
Set the configuration for the currently active document.
@param {Config} config
 */
function setConfigForActiveDocument(config) {
  return _getTriggerManager(DocumentApp.getActiveDocument().getId()).setConfigForActiveDocument(config);
}

/**
Set the configuration for the currently active spreadsheet.
@param {Config} config
 */
function setConfigForActiveSpreadsheet(config) {
  return _getTriggerManager(SpreadsheetApp.getActiveSpreadsheet().getId()).setConfigForActiveDocument(config);
}
