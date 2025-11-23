var $M = $M || {};
$M.drive = {};

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
    ).id;
  }

  rename(file, newName) {
    Drive.Files.update(
      { title: newName }, 
      file.id, 
      { supportsAllDrives: true, fileds: 'id' }
    );
  }

};

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

  createFolder(parentId, name) { 
    try {
      return this._driveApi.createFolder(parentId, name);
    } catch (error) {
      this._reportError(error, `Renaming "${file.id}" as "${newName}" failed.`);
    }
  }

  removeRec(file) {
    const subTreeFiles = this._directory.getSubTreeFiles(file);
    $M.utils.forEachRev(subTreeFiles, this.remove.bind(this));
  }

  copyRec(root, targetFolder) {
    const subTreeFiles = this._directory.getSubTreeFiles(root);
    const folderSourceIdToTargetId = {};
    for (const file of subTreeFiles) {
      const parentTargetId = file.id === root.id ? targetFolder.id : folderSourceIdToTargetId[file.parents[0]];
      if (parentTargetId) {
        if ($M.files.isFolder(file)) {
          const newFolderId = this.createFolder(parentTargetId, file.name);
          folderSourceIdToTargetId[file.id] = newFolderId;  // What happens if null?
        } else {
          this.copyFile(file, parentTargetId);
        }
      } else {
        const message = `Cannot copy "{file}" because target folder does not exist.`;
        this._reportError(new Error(message), message)
      }
    }
  }

};