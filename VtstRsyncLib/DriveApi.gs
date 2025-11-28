var $M = $M || {};
$M.drive = {};

// A mock Drive API that just logs messages on the actions it would do.
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

// Use the Advanced Drive Service.
$M.drive.AdvancedDriveServiceApi = class {

  remove(file) {
    Drive.Files.update(
      { trashed: true },
      file.id,
      null,
      { supportsAllDrives: true, fields: 'id' }
    );
  }

  copyFile(file, targetParent) {
    const newFile = Drive.Files.copy(
      { parents: [targetParent.id], name: file.name }, 
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
    return Drive.Files.create({
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parent.id]
      }, null, { supportsAllDrives: true, fields: 'id' }
    );
  }

  rename(file, newName) {
    Drive.Files.update(
      { name: newName }, 
      file.id,
      null,
      { supportsAllDrives: true, fields: 'id' }
    );
  }

};

$M.drive.DRIVE_API_BATCH_URL = 'https://www.googleapis.com/batch/drive/v3';
$M.drive.MAX_NUMBER_OF_REQUESTS_IN_BATCH = 50;
$M.drive.PAGE_SIZE = 1000;

// Use the batch Drive API.
$M.drive.BatchDriveApi = class {

  _sendRequest(request) {
    const responses = VtstBatchHttpRequestsLib.batchRequestJson($M.drive.DRIVE_API_BATCH_URL, [request]);
    const response = responses[0];
    if (response.error) throw new Error(response.error.message);
    return response;
  }

  getFile(fileId) {
    return this._sendRequest({
      method: 'GET',
      path: '/drive/v3/files/' + fileId,
      params: {
        supportsAllDrives: true,
        fields: 'id,name,parents,size,modifiedTime,mimeType,trashed'
      }
    })
  }

  patchFile(fileId, patch) {
    return this._sendRequest({
      method: 'PATCH',
      path: '/drive/v3/files/' + fileId,
      params: {
        supportsAllDrives: true,
        fields: 'id,name,parents,size,modifiedTime,mimeType,trashed'
      },
      body: patch
    });
  }

  remove(file) {
    this._sendRequest({
      method: 'PATCH',
      path: '/drive/v3/files/' + file.id,
      params: {
        supportsAllDrives: true,
        fields: 'id'
      },
      body: {
        trashed: true
      }
    });
  }

  copyFile(file, targetParent) {
    this._sendRequest({
      method: 'POST',
      path: '/drive/v3/files/' + file.id + '/copy',
      params: {
        supportsAllDrives: true,
        fields: 'id'
      },
      body: {
        parents: [targetParent.id],
        name: file.name,
        modifiedTime: file.modifiedTime
      }
    });
  }

  createFolder(parent, name) {
    return this._sendRequest({
      method: 'POST',
      path: '/drive/v3/files',
      params: {
        supportsAllDrives: true,
        fields: 'id'
      },
      body: {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parent.id]
      }
    });
  }

  rename(file, newName) {
    this._sendRequest({
      method: 'PATCH',
      path: '/drive/v3/files/' + file.id,
      params: {
        supportsAllDrives: true,
        fields: 'id',
      },
      body: {
        name: newName
      }
    });
  }

};
