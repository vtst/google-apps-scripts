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

  constructor(directory, driveApi, logger, throwErrors) {
    this._directory = directory;
    this._driveApi = driveApi;
    this._logger = logger;
    this._throwErrors = throwErrors;
  }

  _reportError(error, message) { 
    this._logger.error(message + '\n' + error.message);
    if (this._throwErrors) throw error;
  }

  remove(file) {
    try {
      this._driveApi.remove(file);
    } catch (error) {
      this._reportError(error, `Removing "${file.id}" failed.`);
    }
  }

  copyFile(file, targetParent) {
    try {
      this._driveApi.copyFile(file, targetParent);
    } catch (error) {
      this._reportError(error, `Copying "${file.id}" in "${targetParent.id}" failed.`)
    }
  }

  rename(file, newName) { 
    try {
      this._driveApi.rename(file.id, newName);
    } catch (error) {
      this._reportError(error, `Renaming "${file.id}" as "${newName}" failed.`);
    }
  }

  createFolder(parent, name) { 
    try {
      return this._driveApi.createFolder(parent, name);
    } catch (error) {
      this._reportError(error, `Renaming "${parent.id}" as "${name}" failed.`);
    }
  }

  removeRec(root) {
    this._directory.forEachUpwards(root, (file, childResults) => {
      if (!childResults.every(x => x)) return false;
      this.remove(file);
      return true;
    });
  }

  copyRec(root, rootParentTargetFolder) {
    this._directory.forEachDownwards(root, (file, targetParentFolder) => {
      if (targetParentFolder) {
        if ($M.files.isFolder(file)) {
          return this.createFolder(targetParentFolder, file.name);
        } else {
          this.copyFile(file, targetParentFolder);
        }
      }
    }, rootParentTargetFolder);
  }

};