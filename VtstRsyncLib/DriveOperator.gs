var $M = $M || {};

// A drive operator orchestrates action with the Drive API to sync two file
// sub-trees to resolve a diff.
// Every method returns true if the action succeeded and false otherwise. This
// allows not performing subsequent changes in case of error.
$M.DriveOperator = class {

  constructor(directory, driveApi, logger) {
    this._directory = directory;
    this._driveApi = driveApi;
    this._logger = logger;
    this.numberOfErrors = 0;
  }

  _reportError(error, message) { 
    this._logger.error(message + '\n' + error.message);
    ++this.numberOfErrors;
  }

  remove(file) {
    try {
      this._driveApi.remove(file);
      return true;
    } catch (error) {
      this._reportError(error, `Removing "${file.id}" failed.`);
      return false;
    }
  }

  copyFile(file, targetParent) {
    try {
      this._driveApi.copyFile(file, targetParent);
      return true;
    } catch (error) {
      this._reportError(error, `Copying "${file.id}" in "${targetParent.id}" failed.`);
      return false;
    }
  }

  rename(file, newName) { 
    try {
      this._driveApi.rename(file, newName);
      return true;
    } catch (error) {
      this._reportError(error, `Renaming "${file.id}" as "${newName}" failed.`);
      return false;
    }
  }

  createFolder(parent, name) { 
    try {
      return this._driveApi.createFolder(parent, name);
    } catch (error) {
      this._reportError(error, `Creation of folder "${name}" in "${parent.id}" failed.`);
      return false;
    }
  }

  removeRec(root) {
    return this._directory.forEachUpwards(root, (file, childResults) => {
      if (!childResults.every(x => x)) return false;
      this.remove(file);
      return true;
    });
  }

  copyRec(root, rootParentTargetFolder) {
    let success = true;
    this._directory.forEachDownwards(root, (file, targetParentFolder) => {
      if (targetParentFolder) {
        if ($M.files.isFolder(file)) {
          const newFolder = this.createFolder(targetParentFolder, file.name);
          if (!newFolder) success = false;
          return newFolder;
        } else {
          if (!this.copyFile(file, targetParentFolder)) success = false;
        }
      }
    }, rootParentTargetFolder);
    return success;
  }

};