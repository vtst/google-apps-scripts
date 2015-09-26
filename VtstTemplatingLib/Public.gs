// (c) Vincent Simonet, 2015
// This file is distributed under the terms of the GNU LGPL.

// TODO: How do we handle permissions?
// - Can we read all files in source folder
// - Can we write in destination
// - Permissions of new files?

function startsWith_(str, prefix) {
  return str.substr(0, prefix.length) == prefix;
};

/**
@param {Folder} folder
@param {string} name
@return {File}
*/
function getFileInFolderByName_(folder, name) {
  var it = folder.getFilesByName(name);
  if (it.hasNext()) return it.next();
  else return null;
};

/**
@param {string} key
@param {File|Folder} fileOrFolder
@return {File}
*/
function getFileFromKey_(key, fileOrFolder) {
  try {
    return DriveApp.getFileById(key);
  } catch (e) {
    if (isFolder_(fileOrFolder)) {
      file = getFileInFolderByName_(fileOrFolder, key);
      if (file) return file;
    }
  }
  throw 'Cannot find file: ' + key;
};

/**
@param {Object.<string, *>} view
@param {File|Folder} fileOrFolder
*/
function shortenUrlsInView_(view, cloner, fileOrFolder) {
  for (var key in view) {
    var value = view[key];
    if (typeof value == 'string') {
      if (startsWith_(value, 'short-file-url:')) {
        var file = getFileFromKey_(value.substr(15), fileOrFolder);
        var copy = cloner.getInstance(file) || file;
        view[key] = shortenUrl_(copy.getUrl());
      } else if (startsWith_(value, 'short-formview-url:')) {
        var file = getFileFromKey_(value.substr(19), fileOrFolder);
        var copy = cloner.getInstance(file) || file;
        var form = FormApp.openById(copy.getId());
        view[key] = shortenUrl_(form.getPublishedUrl());
      }
    }
  }
};

/**
@param {Object.<string, string>} view
@param {File|Folder} fileOrFolder
@param {Folder=} opt_destination
@return {DriveCloner_}
*/
function instantiate(view, fileOrFolder, opt_destination) {
  var destination = opt_destination || DriveApp.getRootFolder();
  var cloner = new DriveCloner_(view);
  var instance = cloner.copy(fileOrFolder, destination);
  shortenUrlsInView_(view, cloner, fileOrFolder);
  cloner.forEachFile(function(original, copy) {
    var handler = FileTypeHandler.get_(original.getMimeType());
    handler.apply(view, cloner, copy);
  });
  return cloner;
};
