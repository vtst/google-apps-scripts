// (c) Vincent Simonet, 2015
// This file is distributed under the terms of the GNU LGPL.

/**
@param {*} view
@constructor
@private
*/
function DriveCloner_(view) {
  this.view_ = view;
  this.files_ = {};
  this.folders_ = {};
};

/**
@param {File} file
@param {Folder} destination
*/
DriveCloner_.prototype.addFile_ = function(file, destination) {
  var id = file.getId();
  var entry = this.files_[id];
  if (!entry) {
    this.files_[id] = {
      original: file,
      originalId: file.getId(),
      copy: null,
      copyId: null,
      destinations: [destination]
    };
  } else {
    entry.destinations.push(destination);
  }  
};

/**
@param {Folder} folder
@param {Folder} destination
@param {Map.<string, string>} fileIdMap
*/
DriveCloner_.prototype.copyFolder_ = function(folder, destination) {
  var entry = this.folders_[folder.getId()];
  if (entry) {
    destination.addFolder(entry.copy);
  } else {
    var copyFolder = destination.createFolder(subst_(this.view_, folder.getName()));
    this.folders_[folder.getId()] = {
      original: folder,
      originalId: folder.getId(),
      copy: copyFolder,
      copyId: copyFolder.getId()
    };
    forEach_(folder.getFolders(), function(subfolder) {
      this.copyFolder_(subfolder, copyFolder);
    }, this);
    forEach_(folder.getFiles(), function(file) {
      this.addFile_(file, copyFolder);
    }, this);
    return copyFolder;
  }
};

/**
@param {File} file
@param {Folder} destination
*/
DriveCloner_.prototype.copyFile_ = function(file, destination) {
  var copyFile = file.makeCopy(subst_(this.view_, file.getName()), destination);
  this.files_[file.getId()] = {
    original: file,
    copy: copyFile
  };
  return copyFile;
};

/**
@param {string} id
@param {File} copy
*/
DriveCloner_.prototype.setFileCopy = function(id, copy) {
  var entry = this.files_[id];
  if (!entry) return false;
  removeFileFromAllParents_(copy);
  copy.setName(subst_(this.view_, entry.original.getName()));
  entry.copy = copy;
  entry.copyId = copy.getId();
  entry.destinations.forEach(function(destination) {
    destination.addFile(entry.copy);
  });  
  return true;
};

/**
*/
DriveCloner_.prototype.copyFiles_ = function() {
  for (var id in this.files_) {
    var entry = this.files_[id];
    var handler = FileTypeHandler.get_(entry.original.getMimeType());
    handler.copy(this, entry.original);
    entry.destinations = undefined;
  }
};

/**
@param {File|Folder} fileOrFolder
@return {File|Folder}
*/
DriveCloner_.prototype.copy = function(fileOrFolder, destination) {
  if (isFolder_(fileOrFolder)) {
    var copy = this.copyFolder_(fileOrFolder, destination);
    this.copyFiles_();
    return copy;
  } else {
    this.addFile_(fileOrFolder, destination);
    this.copyFiles_();
    return this.files_[fileOrFolder.getId()].copy;
  }
};

/**
@param {string} id
@return {boolean}
*/
DriveCloner_.prototype.hasFileId = function(id) {
  return this.files_[id] ? true : false;
};

/**
@param {File|string} file
@return {File}
*/
DriveCloner_.prototype.getInstance = function(file) {
  var id = typeof file == 'string' ? file : file.getId();
  if (isFolder_(file)) {
    var entry = this.folders_[id];
  } else {
    var entry = this.files_[id];
  }
  if (entry) return entry.copy;
  else return null;
};

/**
@param {function(this: CONTEXT, File, File)} fn
@param {CONTEXT=} opt_context
@template CONTEXT
*/
DriveCloner_.prototype.forEachFile = function(fn, opt_context) {
  for (var key in this.files_) {
    var item = this.files_[key];
    fn.call(opt_context, item.original, item.copy);
  }

};
/**
@param {function(this: CONTEXT, string, string)} fn
@param {CONTEXT=} opt_context
@template CONTEXT
*/
DriveCloner_.prototype.forEachFileId = function(fn, opt_context) {
  for (var key in this.files_) {
    var item = this.files_[key];
    fn.call(opt_context, item.originalId, item.copyId);
  }
};
