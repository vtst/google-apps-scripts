// Build a tree of files from Google Drive.

var $M = $M || {};
$M.files = {};

// ********************************************************************************
// Utility functions for the Drive API.

$M.files.FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

$M.files.isFolder = (file) => (file.mimeType === $M.files.FOLDER_MIME_TYPE);

// A wrapper around Drive.Files.list that support paging.
$M.files.listAllPages = (optionalArgs, opt_pageSize) => {
  if (!optionalArgs.pageSize) optionalArgs.pageSize = 1000;
  optionalArgs.pageToken = null;
  optionalArgs.fields = optionalArgs.fields ? 'nextPageToken,' + optionalArgs.fields : 'nextPageToken';
  const files = [];
  do {
    const response = Drive.Files.list(optionalArgs);
    if (response.files) files.push(... response.files);
    optionalArgs.pageToken = response.nextPageToken;
  } while (optionalArgs.pageToken);
  return files;
};

$M.files.getSharedDriveRoot = (driveId) => {
  const root = Drive.Drives.get(driveId, {
    fields: 'id,name',
    supportsAllDrives: true
  });
  root.mimeType = $M.files.FOLDER_MIME_TYPE;
  return root;
};

// ********************************************************************************
// Directory

// An helper class to build a Drive query with series of IDs.
$M.QueryBuilder = class {

  constructor(ids, separator, opt_maxQueryLength) {
    this._ids = [... ids];
    this._separator = separator;
    this._maxQueryLength = opt_maxQueryLength || 8000;
    this._index = 0;
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
      const query = this._ids.slice(this._index, endIndex).join(this._separator);
      this._index = endIndex;
      return query;
    }
  }

};

$M.files.FifoQueue = class {

  constructor(opt_elements) {
    this._queue = opt_elements || [];
    this._index = 0;
  }

  popN(numberOfElements) {
    const startIndex = this._index
    this._index = Math.min(this._index + numberOfElements, this._queue.length);
    return this._queue.slice(startIndex, this._index);
  }

  push(element) {
    this._queue.push(element);
  }

  isNotEmpty() {
    return this._index < this._queue.length;
  }

};

$M.files.DRIVE_API_BATCH_URL = 'https://www.googleapis.com/batch/drive/v3';
$M.files.MAX_NUMBER_OF_REQUESTS_IN_BATCH = 50;
$M.files.PAGE_SIZE = 1000;

// A class to build a directory.
$M.DirectoryBuilder = class {

  constructor(opt_logger) {
    this._files = [];
    this._filesById = {};
    this._fields = 'id,name,parents,size,modifiedTime,mimeType,trashed';
    this._logger = opt_logger;
  }

  build() {
    return new $M.Directory(this._files, this._filesById);
  }

  _pushFile(file) {
    if (file.id in this._filesById || file.trashed) {
      return false;
    } else {
      this._filesById[file.id] = file;
      this._files.push(file);
      return true;
    }
  }

  _pushFiles(files) {
    for (const file of files) this._pushFile(file);
  }

  // Add all files from "My Drive" to the directory.
  addMyDrive() {
    this._pushFiles($M.files.listAllPages({
      q: 'trashed = false',
      fields: `files(${this._fields})`,
      corpora: 'user'
    }));
    // Add the root which is not returned by Files.list.
    const root = Drive.Files.get('root', { fields: this._fields });
    this._pushFile(root);
    this._filesById['root'] = root;
    return this;
  }

  // Add all files from a shared drive to the directory.
  addSharedDrive(driveId) {
    this._pushFiles($M.files.listAllPages({
      q: 'trashed = false',
      fields: `files(${this._fields})`,
      corpora: 'drive',
      driveId: driveId,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    }));
    // Add the root.
    this._pushFile($M.files.getSharedDriveRoot(driveId));
    return this;
  }

  _getFileGetRequest(fileId) {
    return {
      method: 'GET',
      path: '/drive/v3/files/' + fileId,
      params: {
        fields: this._fields,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      },
      fileId: fileId
    };
  }

  _getFileListRequest(fileId, opt_pageToken) {
    return {
      method: 'GET',
      path: '/drive/v3/files',
      params: {
        q: `'${fileId}' in parents and trashed = false`,
        fields: `nextPageToken,files(${this._fields})`,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageSize: $M.files.PAGE_SIZE,
        pageToken: opt_pageToken
      },
      fileId: fileId
    };
  }

  addSubTreesWithBatchAPI(fileIds) {
    const queue = new $M.files.FifoQueue([
      ... fileIds.map(this._getFileGetRequest.bind(this)),
      ... fileIds.map(fileId => this._getFileListRequest(fileId))
    ]);
    const errors = [];
    while (queue.isNotEmpty()) {
      const requests = queue.popN($M.files.MAX_NUMBER_OF_REQUESTS_IN_BATCH);
      const responses = VtstBatchHttpRequestsLib.batchRequestJson($M.files.DRIVE_API_BATCH_URL, requests);
      $M.utils.forEach2(requests, responses, (request, response) => {
        if (response.error) {
          errors.push({request, response});
          if (this._logger) this._logger.error('Drive API error: ' + response.error.message);
        } else {
          if (response.id) {
            // files.get response
            this._pushFile(response);
          } else if (response.files) {
            // files.list response
            if (response.nextPageToken) queue.push(this._getFileListRequest(request.fileId, response.nextPageToken));
            for (const file of response.files) {
              if (this._pushFile(file) && $M.files.isFolder(file)) queue.push(this._getFileListRequest(file.id));
            }
          }
        }
      });
    }
    return errors;
  }

  // Note: This fails if any folder is deleted while the tree is scanned.
  addSubTrees(fileIds) {
    // 'ID_1' in parents or 'ID_2' in parents or 'ID_3' in parents
    const queryBuilder = new $M.QueryBuilder([], "' in parents or '");
    const pushFile = (file) => {
      if (this._pushFile(file) && $M.files.isFolder(file)) queryBuilder.push(file.id)
    }
    // Add the initial files passed as argument.
    for (const fileId of fileIds) {
      try {
        pushFile(Drive.Files.get(fileId, {
          fields: this._fields,
          supportsAllDrives: true
        }));
      } catch (error) {
        if (error.details?.code !== 404) throw error;
      }
    }
    // Add files recursively.
    while (queryBuilder.isNotEmpty()) {
      const files = $M.files.listAllPages({
        q: `('${queryBuilder.getQuery()}' in parents) and trashed = false`,
        fields: `files(${this._fields})`,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      });
      for (const file of files) {
        if (this._pushFile(file) && $M.files.isFolder(file)) queryBuilder.push(file.id);
      }
    }
    return this;
  }

};

// A directory stores a set of files, indexed by IDs, with a graph structure
// enabling navigation to parents and children from any given file.
$M.Directory = class {

  constructor(files, filesById) {
    this._files = files;
    this._filesById = filesById;
    this._buildHierarchy();
  }

  _buildHierarchy(files) {
    for (const file of this._files) {
      if ($M.files.isFolder(file)) {
        file.children = [];
        file.childrenByName = {};
      }
    }
    for (const file of this._files) {
      file.parents = $M.utils.mapFilter(file.parents || [], parentId => {
        const parent = this._filesById[parentId];
        if (parent) {
          parent.children.push(file.id);
          parent.childrenByName[file.name] = file.id;
          return parentId;
        }
      });
    }
  }

  getFileById(id) {
    return this._filesById[id];
  }
  
  // Apply fn on rootFile and every descendant of root file, from top to bottom.
  // The value returned by fn on a node is passed to its children as the context argument.
  // Note: This function does not terminate if there is a loop somewhere in the graph.
  forEachDownwards(rootFile, fn, context, opt_obj) {
    const contextForChildren = fn.call(opt_obj, rootFile, context);
    if (rootFile.children) {
      for (const childId of rootFile.children) {
        const child = this.getFileById(childId);
        if (child) this.forEachDownwards(child, fn, contextForChildren, opt_obj);
      }
    }
  }

  // Apply fn on rootFile and every descendant of root file, from bottom to top.
  // The values returned by fn on the children of a node are passed as argument to fn
  // as an array when fn is called on the node.
  // Note: This function does not terminate if there is a loop somewhere in the graph.
  forEachUpwards(rootFile, fn, opt_obj) {
    const childrenResults = rootFile.children ? rootFile.children.map(child => (this.forEachUpwards(child, fn, opt_obj))) : [];
    return fn.call(opt_obj, rootFile, childrenResults);
  }

  // Return a pretty-print of a sub-tree into a string.
  printSubTree(rootFile) {
    const lines = [];
    this.forEachDownwards(rootFile, (file, {depth}) => {
      lines.push('  '.repeat(depth) + file.name);
      return {depth: depth + 1};
    }, {depth: 0});
    return lines.join('\n');
  }

  // Return true if there is a loop encountered when walking in the sub-tree of
  // rootFile descendants.
  hasLoop(rootFile) {
    const visitedFiles = new Set;
    const walk = (file) => {
      if (!file) return false;
      if (visitedFiles.has(file.id)) return true;
      visitedFiles.add(file.id);
      if (visitedFiles.children) {
        return visitedFiles.children.some(childId => (walk(this.getFileById(childId))));
      } else {
        return false;
      }
    }
    return walk(rootFile);
  }

};
