var $M = $M || {};
$M.drive = {};

$M.drive.PAGE_SIZE = 1000;

$M.drive.FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

$M.drive.isFolder = (file) => (file.mimeType === $M.drive.FOLDER_MIME_TYPE);

// ********************************************************************************
// Counters

$M.drive.SyncCounters = class {

  constructor() {
    this.reset();
  }

  reset() {
    this.error = 0;
    this.rename = 0;
    this.create = 0;
    this.remove = 0;
    this.copy = 0;
  }

  toString() {
    const fragments = [];
    function push(count, text) {
      if (count > 0) fragments.push(`${count} ${text}`);
    }
    push(this.error, 'error(s)');
    push(this.rename, 'file(s) and folder(s) renamed');
    push(this.create, 'folder(s) created');
    push(this.remove, 'file(s) and folder(s) removed');
    push(this.copy, 'file(s) copied');
    return fragments.join(', ');
  }
}

// ********************************************************************************
// MockDriveApi

// A mock Drive API that just logs messages on the actions it would do.
$M.drive.MockDriveApi = class {

  constructor(logger) {
    this._logger = logger;
    this._syncCounters = new $M.drive.SyncCounters;
  }

  getFile(fileId, fields) {
    throw 'Not implemented';
  }

  listFiles(params) {
    throw 'Not implemented';
  }

  walkSubTrees(fileIds, fields, fn, opt_obj) {
    throw 'Not implemented';
  }

  syncStart() {
    this._syncCounters.reset();
  }

  syncNode(replacedTargetFile, newName, newSourceFileRoot, targetParent) {
    if (replacedTargetFile) {
      if (newName) {
        this._logger.info(`Renaming file "${file.id}" as "${newName}"`);
      } else {
        this._logger.info(`Removing file "${file.id}"`);
      }
    }
    if (newSourceFileRoot) {
      this._logger.info(`Copying file "${newSourceFileRoot.id}" in "${targetParent.id}"`);
    }
  }

  syncEnd() {
    return this._syncCounters;
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
$M.drive.AdvancedDriveServiceApi = class extends $M.drive.MockDriveApi {

  getFile(fileId, fields) {
    return Drive.Files.get(fileId, { fields, supportsAllDrives: true });
  }

  listFiles(params) {
    return Drive.Files.list(params);
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
        throw new Error(`Error while listing files of ${queryBuilder.idsOfLastQuery.join(', ')}: ${e.message}`);
      }
    }
  }

  _removeFile(file) {
    Drive.Files.update(
      { trashed: true },
      file.id,
      null,
      { supportsAllDrives: true, fields: 'id' }
    );
  }

  _copyFile(file, targetParent) {
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

  _createFolder(parent, name) {
    return Drive.Files.create({
        name: name,
        mimeType: $M.drive.FOLDER_MIME_TYPE,
        parents: [parent.id]
      }, null, { supportsAllDrives: true, fields: 'id' }
    );
  }

  _renameFile(file, newName) {
    Drive.Files.update(
      { name: newName }, 
      file.id,
      null,
      { supportsAllDrives: true, fields: 'id' }
    );
  }

  syncNode(replacedTargetFile, newName, newSourceFileRoot, targetParent) {
    if (replacedTargetFile) {
      if (newName) {
        this._logger.info(`Renaming file "${file.id}" as "${newName}"`);
        try {
          this._renameFile(replacedTargetFile, newName);
          ++this._syncCounters.rename;
        } catch (error) {
          this._logger.error(`Renaming failed: ${error.message}`);
          ++this._syncCounters.error;
          return;
        }
      } else {
        this._logger.info(`Removing file "${file.id}"`);
        try {
          this._removeFile(replacedTargetFile);
          ++this._syncCounters.remove;
        } catch (error) {
          this._logger.error(`Removal failed: ${error.message}`);
          ++this._syncCounters.error;
          return;
        }
      }
    }
    if (newSourceFileRoot) {
      this._logger.info(`Recursively copying "${newSourceFileRoot.id}" in "${targetParent.id}"`);
      $M.files.forEachDownwards(newSourceFileRoot, (file, targetParentFolder) => {
        if (targetParentFolder) {
          if ($M.drive.isFolder(file)) {
            try {
              const newFolder = this._createFolder(targetParentFolder, file.name);
              ++this._syncCounters.create;
              return newFolder
            } catch (error) {
              this._logger.error(`Creation of folder in "${targetParentFolder.id}" failed: ${error.message}`);
              ++this._syncCounters.error;
            }
          } else {
            try {
              this._copyFile(file, targetParentFolder);
              ++this._syncCounters.copy;
            } catch (error) {
              this._logger.error(`Copy of "${file.id}" in "${targetParentFolder.id}" failed: ${error.message}`);
              ++this._syncCounters.error;
            }
          }
        }
      }, targetParent);
    }
  }

};

// ********************************************************************************
// BatchDriveApi

$M.drive.DRIVE_API_BATCH_URL = 'https://www.googleapis.com/batch/drive/v3';
$M.drive.MAX_NUMBER_OF_REQUESTS_IN_BATCH = 50;

$M.drive.FifoQueue = class {

  constructor(opt_elements) {
    this._queue = opt_elements || [];
    this._priorityQueue = [];
    this._index = 0;
  }

  popN(numberOfElements) {
    const startIndex = this._index;
    if (this._priorityQueue.length > 0) {
      this._queue.splice(this._index, 0, ... this._priorityQueue)
      this._priorityQueue = [];
    }
    this._index = Math.min(this._index + numberOfElements, this._queue.length);
    return this._queue.slice(startIndex, this._index);
  }

  push(element) {
    this._queue.push(element);
  }

  pushPriority(element) {
    this._priorityQueue.push(element);
  }

  isNotEmpty() {
    return this._priorityQueue.length > 0 || this._index < this._queue.length;
  }

};

// Use the batch Drive API.
$M.drive.BatchDriveApi = class extends $M.drive.MockDriveApi {

  constructor(logger) {
    super(logger);
  }

  _runSingleRequest(request) {
    const responses = VtstBatchHttpRequestsLib.batchRequestJson($M.drive.DRIVE_API_BATCH_URL, [request]);
    const response = responses[0];
    if (response.error) throw new Error(response.error.message);
    return response;
  }


  _runAllRequests(queue, fn, opt_obj) {
    while (queue.isNotEmpty()) {
      const requests = queue.popN($M.drive.MAX_NUMBER_OF_REQUESTS_IN_BATCH);
      const responses = VtstBatchHttpRequestsLib.batchRequestJson($M.drive.DRIVE_API_BATCH_URL, requests);
      $M.utils.forEach2(requests, responses, fn, opt_obj);
    }
  }

  getFile(fileId, fields) {
    const file = this._runSingleRequest({
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
    const response = this._runSingleRequest({
      method: 'GET',
      path: '/drive/v3/files',
      params
    });
    if (response.error) throw new Error(response.error.message);
    return response;
  }

  _fileGetRequest(fields, fileId) {
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

  _fileListRequest(fields, fileId, opt_pageToken) {
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
      ... fileIds.map(this._fileGetRequest.bind(this, fields)),
      ... fileIds.map(fileId => this._fileListRequest(fields, fileId))
    ]);
    this._runAllRequests(queue, (request, response) => {
      if (response.error) {
        throw new Error(`Error while listing files of ${request.fileId}: ${response.error.message}`);
      } else {
        if (response.id) {
          // files.get response
          fn.call(opt_obj, response);
        } else if (response.files) {
          // files.list response
          if (response.nextPageToken) queue.pushPriority(this._fileListRequest(fields, request.fileId, response.nextPageToken));
          for (const file of response.files) {
            if ((!(fn.call(opt_obj, file))) && $M.drive.isFolder(file)) queue.push(this._fileListRequest(fields, file.id));
          }
        }
      }
    });
  }

  _removeFileRequest(file) {
    return {
      method: 'PATCH',
      path: '/drive/v3/files/' + file.id,
      params: {
        supportsAllDrives: true,
        fields: 'id'
      },
      body: {
        trashed: true
      }
    };
  }

  _copyFileRequest(source, targetParent) {
    return {
      method: 'POST',
      path: '/drive/v3/files/' + source.id + '/copy',
      params: {
        supportsAllDrives: true,
        fields: 'id'
      },
      body: {
        parents: [targetParent.id],
        name: source.name,
        modifiedTime: source.modifiedTime
      },
      _source: source,
      _targetParent: targetParent
    };
  }

  _createFolderRequest(source, targetParent) {
    return {
      method: 'POST',
      path: '/drive/v3/files',
      params: {
        supportsAllDrives: true,
        fields: 'id'
      },
      body: {
        name: source.name,
        mimeType: $M.drive.FOLDER_MIME_TYPE,
        parents: [targetParent.id]
      },
      _source: source,
      _targetParent: targetParent
    };
  }

  _renameFileRequest(file, newName) {
    return {
      method: 'PATCH',
      path: '/drive/v3/files/' + file.id,
      params: {
        supportsAllDrives: true,
        fields: 'id',
      },
      body: {
        name: newName
      }
    };
  }

  syncStart() {
    super.syncStart();
    this._syncNodes = [];
  }

  syncNode(replacedTargetFile, newName, newSourceFileRoot, targetParent) {
    this._syncNodes.push({replacedTargetFile, newName, newSourceFileRoot, targetParent});
  }

  syncEnd() {
    // Step 1: remove and rename requests.
    const removeAndRenameRequests = new $M.drive.FifoQueue($M.utils.mapFilter(this._syncNodes, (syncNode, index) => {
      if (syncNode.replacedTargetFile) {
        const request = syncNode.newName ?
          this._renameFileRequest(syncNode.replacedTargetFile, syncNode.newName) :
          this._removeFileRequest(syncNode.replacedTargetFile);
        request._syncNodeIndex = index;
        return request;
      }
    }));
    this._runAllRequests(removeAndRenameRequests, (request, response) => {
      if (response.error) {
        const syncNode = this._syncNodes[request._syncNodeIndex];
        this._logger.error(`${syncNode.newName ? "Renaming" : "Removal"} of file "${syncNode.replacedTargetFile.id}" failed: ${error.message}`);
        ++this._syncCounters.error;
        this._syncNodes[request._syncNodeIndex].step1Failed = true;
      } else {
        if (syncNode.newName) ++this._syncCounters.rename; else ++this._syncCounters.remove;
      }
    });
    // Step 2: create folders.
    const createFolderRequests = new $M.drive.FifoQueue;
    const copyFileRequests = new $M.drive.FifoQueue;
    const enqueue = (source, targetParent) => {
      if ($M.drive.isFolder(source)) createFolderRequests.push(this._createFolderRequest(source, targetParent));
      else copyFileRequests.push(this._copyFileRequest(source, targetParent));
    }
    for (const syncNode of this._syncNodes) {
      if (syncNode.newSourceFileRoot && !syncNode.step1Failed) enqueue(syncNode.newSourceFileRoot, syncNode.targetParent);
    }
    this._runAllRequests(createFolderRequests, (request, response) => {
      if (response.error) {
        this._logger.error(`Creation of folder "${request._source.name}" in "${request._targetParent.id}" failed: ${error.message}`);
        ++this._syncCounters.error;  
      } else if (request._source._children) {
        // response is the newly created folder.
        request._source._children.forEach(child => { enqueue(child, response); });
        ++this._syncCounters.create;
      }
    });
    // Step 3: copy files.
    this._runAllRequests(copyFileRequests, (request, response) => {
      if (response.error) {
        this._logger.error(`Copy of "${request._source.id}" in "${request._targetParent.id}" failed: ${error.message}`);
        ++this._syncCounters.error;
      } else {
        ++this._syncCounters.copy;
      }
    });
    return super.syncEnd();
  }

};
