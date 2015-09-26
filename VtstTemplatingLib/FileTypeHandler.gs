// (c) Vincent Simonet, 2015
// This file is distributed under the terms of the GNU LGPL.

// ********************************************************************************
// Interface FileTypeHandler

function FileTypeHandler() {};

/**
@param {Object.<string, string>} view
@param {DriveCloner_} cloner
@param {File} file
*/
FileTypeHandler.prototype.apply;

/**
@param {DriveCloner_} cloner
@param {File} file
@return {File}
*/
FileTypeHandler.prototype.copy;

/**
@private {Object.<string, FileTypeHandler>}
*/
FileTypeHandler.REGISTRY_ = {};

/**
@param {string} mimeType
@param {FileTypeHandler} handler
*/
function registerFileTypeHandler(mimeType, handlerCtor) {
  FileTypeHandler.REGISTRY_[mimeType] = new handlerCtor;
};

/**
@param {string} mimeType
@return {FileTypeHandler|null}
@private
*/
FileTypeHandler.get_ = function(mimeType) {
  return FileTypeHandler.REGISTRY_[mimeType] || FileTypeHandler.DEFAULT_;
};

// ********************************************************************************
// Class DefaultHandler_

/**
@constructor
@implements FileTypeHandler
*/
function DefaultHandler_() {
};

DefaultHandler_.prototype.copy = function(cloner, file) {
  cloner.setFileCopy(file.getId(), file.makeCopy(DriveApp.getRootFolder()));
};

DefaultHandler_.prototype.apply = function(view, cloner, file) {
};

/** @const {FileTypeHandler} */
FileTypeHandler.DEFAULT_ = new DefaultHandler_;

// ********************************************************************************
// Class DocumentHandler_

/**
@constructor
@implements FileTypeHandler
*/
function DocumentHandler_() {};

DocumentHandler_.prototype.copy = DefaultHandler_.prototype.copy;

/**
Iterate recursively over an element
@param {DocumentApp.Element} element
@param {function(this: CONTEXT, DocumentApp.Element)} fn
@param {CONTEX=} opt_context
@template CONTEXT
*/
DocumentHandler_.prototype.iterElement_ = function(element, fn, opt_context) {
  fn.call(opt_context, element);
  if ('getNumChildren' in element) {
    var n = element.getNumChildren();
    for (var i = 0; i < n; ++i) {
      this.iterElement_(element.getChild(i), fn, opt_context);
    }
  }
};

/**
Iterate over all elements in a document.
@param {DocumentApp.Document} doc
@param {function(this: CONTEXT, DocumentApp.Element)} fn
@param {CONTEX=} opt_context
@template CONTEXT
*/
DocumentHandler_.prototype.iterDocument_ = function(doc, fn, opt_context) {
  this.iterElement_(doc.getBody(), fn, opt_context);
};

/**
Iterate over all text fragments in a DocumentApp.Text.
@param {DocumentApp.Text} text
@param {function(this: CONTEXT, number, number)} fn
@param {CONTEX=} opt_context
@template CONTEXT
*/
DocumentHandler_.prototype.iterTextFragments_ = function(text, fn, opt_context) {
  var indices = text.getTextAttributeIndices();
  indices.push(text.getText().length);
  for (var i = 0; i < indices.length - 1; ++i) {
    fn.call(opt_context, indices[i], indices[i+1] - 1);
  }
};

/**
For every key in values, replace {{key}} by values[key] in doc.
@param {Object.<string, string>} view
@param {DocumentApp.Document} doc
*/
DocumentHandler_.prototype.replaceValues_ = function(view, doc) {
  var body = doc.getBody();
  for (var key in view) {
    body.replaceText('\\{\\{' + key + '\\}\\}', view[key] + '');
  }
};

/**
@param {DriveCloner_} cloner
@param {string} url
*/
DocumentHandler_.prototype.rewriteUrl_ = function(cloner, url) {
  cloner.forEachFileId(function(originalId, copyId) {
    url = url.replace('/' + originalId + '/', '/' + copyId + '/');
  });
  return url;
};

/**
@param {DriveCloner_} cloner
@param {DocumentApp.Document} doc
*/
DocumentHandler_.prototype.rewriteUrls_ = function(cloner, doc) {
  this.iterDocument_(doc, function(element) {
    if (element.getType() == DocumentApp.ElementType.TEXT) {
      var text = element.asText();
      this.iterTextFragments_(text, function(start, end) {
        var url = text.getLinkUrl(start);
        if (url) {
          text.setLinkUrl(start, end, this.rewriteUrl_(cloner, url));
        }
      }, this);
    }
  }, this);
};

DocumentHandler_.prototype.apply = function(view, cloner, file) {
  var doc = DocumentApp.openById(file.getId());
  this.replaceValues_(view, doc);
  this.rewriteUrls_(cloner, doc);
};

registerFileTypeHandler('application/vnd.google-apps.document', DocumentHandler_);

// ********************************************************************************
// Class FormHandler_

/**
@constructor
@implements FileTypeHandler
*/
function FormHandler_() {};

FormHandler_.prototype.copy = function(cloner, file) {
  var form = FormApp.openById(file.getId());
  var destinationId = getFormDestinationId_(form);
  if (!(destinationId && cloner.hasFileId(destinationId))) {
    DefaultHandler_.prototype.copy.call(this, cloner, file);
  }
};

FormHandler_.prototype.apply = function(view, cloner, file) {
  var form = FormApp.openById(file.getId());
  // TODO: https://developers.google.com/apps-script/reference/forms/destination-type
  form.setTitle(subst_(view, form.getTitle()));
  form.setDescription(subst_(view, form.getDescription()));
  var items = form.getItems();
  for (var i = 0; i < items.length; ++i) {
    var item  = items[i];
    item.setTitle(subst_(view, item.getTitle()));
    item.setHelpText(subst_(view, item.getHelpText()));
  }
  // TODO if (!endsWith(file.getName(), ' (Form)')) createFormResponseSheet(eventFolder, form);
};

registerFileTypeHandler('application/vnd.google-apps.form', FormHandler_);

// ********************************************************************************
// Class SpreadsheetHandler_

/**
@constructor
@implements FileTypeHandler
*/
function SpreadsheetHandler_() {
};

SpreadsheetHandler_.prototype.copy = function(cloner, file) {
  var fileCopy = file.makeCopy(DriveApp.getRootFolder());
  cloner.setFileCopy(file.getId(), fileCopy);
  var spreadsheet = SpreadsheetApp.open(file);
  var formId = getSpreadsheetFormId_(spreadsheet);
  if (formId) {
    var spreadsheetCopy = SpreadsheetApp.open(fileCopy);
    var formCopyId = assert_(getSpreadsheetFormId_(spreadsheetCopy));
    var formCopyFile = DriveApp.getFileById(formCopyId);
    if (!cloner.setFileCopy(formId, DriveApp.getFileById(formCopyId))) {
      removeFileFromAllParents_(formCopyFile);
    }
  }
};
DefaultHandler_.prototype.copy;

SpreadsheetHandler_.prototype.apply = function(view, cloner, file) {
};

registerFileTypeHandler('application/vnd.google-apps.spreadsheet', SpreadsheetHandler_);
