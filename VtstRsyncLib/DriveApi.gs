var $M = $M || {};
$M.drive = {};

$M.drive.PAGE_SIZE = 1000;

$M.drive.FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

$M.drive.isFolder = (file) => (file.mimeType === $M.drive.FOLDER_MIME_TYPE);


// ********************************************************************************
// MockDriveApi

// A mock Drive API that just logs messages on the actions it would do.
$M.drive.MockDriveApi = class {

  constructor(logger) {
    this._logger = logger;
  }

  getFile(fileId, fields) {
    throw 'Not implemented';
  }

  listFiles(params) {
    throw 'Not implemented';
  }

  removeFile(file) {
    this._logger.info(`File removal: file ID ${file.id} set to trashed: true.`);
  }

  copyFile(file, targetParent) {
    this._logger.info(`Copy of file ${file.id} (modified time ${file.modifiedTime}) to parent ${targetParent.id}.`);
  }

  createFolder(parent, name) {
    this._logger.info(`Creation of folder "${name}" in parent ${parent.id}.`);
    return {id: `MOCKED_FOLDER_ID_${parent.id}_${name}`};
  }

  renameFile(file, newName) {
    this._logger.info(`Rename of file ID ${file.id} to "${newName}".`);
  }

  walkSubTrees(fileIds, fields, fn, opt_obj) {
    this._logger.info(`Walk sub-tree of folder IDs ${fileIds.join(', ')}`);
  }

};

// ********************************************************************************
// AdvancedDriveServiceApi

// An helper class to build a Drive query with series of IDs.
$M.drive.QueryBuilder = class {

  constructor(ids, separator, opt_maxQueryLength) {
    this._ids = [... ids];
    this._separator = separator;
    this._maxQueryLength = opt_maxQueryLength || 8000;
    this._index = 0;
    this.idsOfLastQuery = [];
  }

  isNotEmpty() {
    return this._index < this._ids.length;
  }

  push(parentId) {
    this._ids.push(parentId);
  }

  getQuery() {
    let endIndex = this._index;
    let queryLength = - this._separator.length;
    while (endIndex < this._ids.length && queryLength < this._maxQueryLength) {
      queryLength += this._ids[endIndex].length + this._separator.length;
      ++endIndex;
    }
    if (endIndex > this._index) {
      this.idsOfLastQuery = this._ids.slice(this._index, endIndex);
      const query = this.idsOfLastQuery.join(this._separator);
      this._index = endIndex;
      return query;
    }
  }

};

$M.drive.listAllPages = (optionalArgs, opt_pageSize) => {
  if (!optionalArgs.pageSize) optionalArgs.pageSize = $M.drive.PAGE_SIZE;
  optionalArgs.pageToken = undefined;
  optionalArgs.fields = optionalArgs.fields ? 'nextPageToken,' + optionalArgs.fields : 'nextPageToken';
  const files = [];
  do {
    const response = Drive.Files.list(optionalArgs);
    if (response.files) files.push(... response.files);
    optionalArgs.pageToken = response.nextPageToken;
  } while (optionalArgs.pageToken);
  return files;
};


// Use the Advanced Drive Service.
$M.drive.AdvancedDriveServiceApi = class {

  getFile(fileId, fields) {
    return Drive.Files.get(fileId, { fields, supportsAllDrives: true });
  }

  listFiles(params) {
    return Drive.Files.list(params);
  }

  removeFile(file) {
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
        mimeType: $M.drive.FOLDER_MIME_TYPE,
        parents: [parent.id]
      }, null, { supportsAllDrives: true, fields: 'id' }
    );
  }

  renameFile(file, newName) {
    Drive.Files.update(
      { name: newName }, 
      file.id,
      null,
      { supportsAllDrives: true, fields: 'id' }
    );
  }

  // Note: This fails if any folder is deleted while the tree is scanned.
  walkSubTrees(fileIds, fields, fn, opt_obj) {
    // 'ID_1' in parents or 'ID_2' in parents or 'ID_3' in parents
    const queryBuilder = new $M.drive.QueryBuilder([], "' in parents or '");
    const pushFile = (file) => {
      if (!fn.call(opt_obj, file) && $M.drive.isFolder(file)) queryBuilder.push(file.id)
    }
    // Add the initial files passed as argument.
    for (const fileId of fileIds) {
      try {
        pushFile(Drive.Files.get(fileId, {
          fields: fields,
          supportsAllDrives: true
        }));
      } catch (error) {
        if (error.details?.code !== 404) throw error;
      }
    }
    // Add files recursively.
    while (queryBuilder.isNotEmpty()) {
      try {
        const files = $M.drive.listAllPages({
          q: `('${queryBuilder.getQuery()}' in parents) and trashed = false`,
          fields: `files(${fields})`,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true
        });
        for (const file of files) pushFile(file);
      } catch (e) {
        errors.push({
          message: e.message,
          fileIds: queryBuilder.idsOfLastQuery
        });
      }
    }
    return errors;
  }

};

// ********************************************************************************
// BatchDriveApi

$M.drive.DRIVE_API_BATCH_URL = 'https://www.googleapis.com/batch/drive/v3';
$M.drive.MAX_NUMBER_OF_REQUESTS_IN_BATCH = 50;

$M.drive.FifoQueue = class {

  constructor(opt_elements) {
    this._queue = opt_elements || [];
    this._index = 0;
  }

  popN(numberOfElements) {
    const startIndex = this._index
    this._index = Math.min(this._index + numberOfElements, this._queue.length);
    Logger.log(this._index);
    return this._queue.slice(startIndex, this._index);
  }

  pushN(headElements, tailElements) {
    this._queue.splice(this._index, 0, ... headElements);
    this._queue.push(... tailElements);
  }

  isNotEmpty() {
    return this._index < this._queue.length;
  }

};

// Use the batch Drive API.
$M.drive.BatchDriveApi = class {

  _sendRequest(request) {
    const responses = VtstBatchHttpRequestsLib.batchRequestJson($M.drive.DRIVE_API_BATCH_URL, [request]);
    const response = responses[0];
    if (response.error) throw new Error(response.error.message);
    return response;
  }

  getFile(fileId, fields) {
    const file = this._sendRequest({
      method: 'GET',
      path: '/drive/v3/files/' + fileId,
      params: {
        supportsAllDrives: true,
        fields
      }
    });
    if (file.error) throw new Error(file.error.message);
    return file;
  }

  listFiles(params) {
    Logger.log(JSON.stringify(params, null, 2));
    const response = this._sendRequest({
      method: 'GET',
      path: '/drive/v3/files',
      params
    });
    if (response.error) throw new Error(response.error.message);
    return response;
  }

  removeFile(file) {
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
        mimeType: $M.drive.FOLDER_MIME_TYPE,
        parents: [parent.id]
      }
    });
  }

  renameFile(file, newName) {
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

  _getFileGetRequest(fields, fileId) {
    return {
      method: 'GET',
      path: '/drive/v3/files/' + fileId,
      params: {
        fields,
        supportsAllDrives: true
      },
      fileId: fileId
    };
  }

  _getFileListRequest(fields, fileId, opt_pageToken) {
    return {
      method: 'GET',
      path: '/drive/v3/files',
      params: {
        q: `'${fileId}' in parents and trashed = false`,
        fields: `nextPageToken,files(${fields})`,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageSize: $M.files.PAGE_SIZE,
        pageToken: opt_pageToken
      },
      fileId: fileId
    };
  }

  walkSubTrees(fileIds, fields, fn, opt_obj) {
    const queue = new $M.drive.FifoQueue([
      ... fileIds.map(this._getFileGetRequest.bind(this, fields)),
      ... fileIds.map(fileId => this._getFileListRequest(fields, fileId))
    ]);
    const errors = [];
    while (queue.isNotEmpty()) {
      const requests = queue.popN($M.drive.MAX_NUMBER_OF_REQUESTS_IN_BATCH);
      const responses = VtstBatchHttpRequestsLib.batchRequestJson($M.drive.DRIVE_API_BATCH_URL, requests);
      const nextPageRequests = [], newFolderRequests = [];
      $M.utils.forEach2(requests, responses, (request, response) => {
        if (response.error) {
          errors.push({
            message: response.error.message,
            fileIds: [request.fileId]
          });
          // TODO if (this._logger) this._logger.error('Drive API error: ' + response.error.message);
        } else {
          if (response.id) {
            // files.get response
            fn.call(opt_obj, response);
          } else if (response.files) {
            // files.list response
            if (response.nextPageToken) nextPageRequests.push(this._getFileListRequest(fields, request.fileId, response.nextPageToken));
            for (const file of response.files) {
              if ((!(fn.call(opt_obj, file))) && $M.drive.isFolder(file)) newFolderRequests.push(this._getFileListRequest(fields, file.id));
            }
          }
        }
      });
      queue.pushN(nextPageRequests, newFolderRequests);
    }
    return errors;
  }

};
