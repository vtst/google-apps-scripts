var $M = $M || {};
$M.drive = {};

// ********************************************************************************
// Drive API

$M.drive.MockDriveApi = class {

  constructor(logger) {
    this._logger = logger;
  }


  remove(file) {
    this._logger.info(`File removal: file ID ${file.id} set to trashed: true.`);
  }

  copyFile(file, targetParent) {
    this._logger.info(`Copy of file ${file.id} (modified time ${file.modifiedTime}) to parent ${targetParent.id}.`);
  }

  createFolder(parent, name) {
    this._logger.info(`Creation of folder "${name}" in parent ${parent.id}.`);
    return {id: `MOCKED_FOLDER_ID_${parent.id}_${name}`};
  }

  rename(file, newName) {
    this._logger.info(`Rename of file ID ${file.id} to "${newName}".`);
  }

};

$M.drive.AdvancedDriveServiceApi = class {

  remove(file) {
    Drive.Files.update(
      { trashed: true },
      file.id, 
      { supportsAllDrives: true, fields: 'id' }
    );
  }

  copyFile(file, targetParent) {
    const newFile = Drive.Files.copy(
      { parents: [{ id: targetParent.id }] }, 
      file.id, 
      { supportsAllDrives: true, fields: 'id' }
    );
    Drive.Files.update({
      modifiedTime: file.modifiedTime
    }, newFile.id,
    null, {
      setModifiedDate: true, 
      supportsAllDrives: true, 
      fields: 'id'
    });
  }

  createFolder(parent, name) {
    return Drive.Files.insert({
        title: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [{ id: parent.id }]
      }, { supportsAllDrives: true, fields: 'id' }
    );
  }

  rename(file, newName) {
    Drive.Files.update(
      { title: newName }, 
      file.id, 
      { supportsAllDrives: true, fileds: 'id' }
    );
  }

};

// ********************************************************************************
// Drive Operator

$M.drive.DriveOperator = class {

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
      this._driveApi.rename(file.id, newName);
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