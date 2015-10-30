// (c) Vincent Simonet, 2015
// This file is distributed under the terms of the GNU LGPL.

/**
@param {Iterator.<T>} iterator
@param {function(this: CONTEXT, T)} fn
@param {CONTEXT=} opt_context
@template CONTEXT, T
*/
function forEach_(iterator, fn, opt_context) {
  while (iterator.hasNext()) {
    fn.call(opt_context, iterator.next());
  }
};

/**
@param {File} file
*/
function removeFileFromAllParents_(file) {
  forEach_(file.getParents(), function(folder) {
    folder.removeFile(file);
  });
};

/**
@param {File|Folder} fileOrFolder
@return {boolean}
*/
function isFolder_(fileOrFolder) {
  if (fileOrFolder.getFiles) return true; 
  else return false;
};

var RE_DOLLAR_ = new RegExp('[$]', 'g');

/**
@param {*} view
@param {string} str
@return {string}
*/
function subst_(view, str) {
  str = str + '';
  for (var key in view) {
    var re = new RegExp('{{' + key + '}}', 'g');
    str = str.replace(re, (view[key] + '').replace(RE_DOLLAR_, '$$$$'));
  }
  return str;
};

/**
@param {T} cnd
@return {T}
@template T
*/
function assert_(cnd) {
  if (!cnd) throw 'Assertion error';
  return cnd;
};

/**
@param {Form} form
@return {string}
*/
function getFormDestinationId_(form) {
  try {
    return form.getDestinationId();
  } catch (e) {
    return null;
  }
};

/**
@param {Spreadsheet} spreadsheet
@return {string}
*/
function getSpreadsheetFormId_(spreadsheet) {
  var url = spreadsheet.getFormUrl();
  if (url) {
    var m = url.match(/^.*\/([^\/]*)\/viewform$/);
    if (m) return m[1];
  }
  return null;
};

/**
@param {string} longUrl
@return {string}
*/
function shortenUrl_(longUrl) {
  return UrlShortener.Url.insert({longUrl: longUrl}).id;
};

/**
@param {Folder} folder
@param {string} name
@return {File}
*/
function getFileInFolderByName_(folder, name) {
  var it = folder.getFilesByName(name);
  if (!it.hasNext()) return null;
  var file = it.next();
  if (it.hasNext()) throw 'Multiple files named "' + name + '"';
  return file;
};
