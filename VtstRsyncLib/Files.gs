// Build a tree of files from Google Drive.

var $M = $M || {};
$M.files = {};

// ********************************************************************************
// Utility functions for the Drive API.

$M.files.FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

// A wrapper around Drive.Files.list that support paging.
$M.files.listAllPages = (optionalArgs, opt_pageSize) => {
  Logger.log(JSON.stringify(optionalArgs, null, 2));
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

// An helper class to build with series of IDs.
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

}

// A class to build a directory.
$M.DirectoryBuilder = class {

  constructor() {
    this._files = [];
    this._filesById = {};
    this._fields = 'id,name,parents,size,modifiedTime,mimeType,trashed';
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
    return root.id;
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
  }

  addSubTrees(fileIds) {
    // 'ID_1' in parents or 'ID_2' in parents or 'ID_3' in parents
    const queryBuilder = new $M.QueryBuilder([], "' in parents or '");
    const pushFile = (file) => {
      if (this._pushFile(file) && file.mimeType === $M.files.FOLDER_MIME_TYPE) queryBuilder.push(file.id)
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
        if (this._pushFile(file) && file.mimeType === $M.files.FOLDER_MIME_TYPE) queryBuilder.push(file.id);
      }
    }
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
      file.parents = $M.utils.mapFilter(file.parents || [], parentId => {
        const parent = this._filesById[parentId];
        if (parent) {
          if (!(parent.children)) {
            parent.children = [];
            parent.childrenByName = {};
          }
          parent.children.push(file.id);
          parent.childrenByName[file.name] = file.id;
          return parentId;
        }
      });
    }
  }

  getFiles() {
    return this._files;
  }

  getFileById(id) {
    return this._filesById[id];
  }

  getRoots() {
    return this._files.filter(file => !file.parents || file.parents.length === 0);
  }

  forEachInSubTree(rootFile, fn, context, opt_obj) {
    const contextForChildren = fn.call(opt_obj, rootFile, context);
    if (rootFile.children) {
      for (const childId of rootFile.children) {
        const child = this.getFileById(childId);
        if (child) this.forEachInSubTree(child, fn, contextForChildren, opt_obj);
      }
    }
  }

  printSubTree(rootFile) {
    const buffer = [];
    this.forEachInSubTree(rootFile, (file, {depth}) => {
      buffer.push('  '.repeat(depth) + file.name);
      return {depth: depth + 1};
    }, {depth: 0});
    return buffer.join('\n');
  }

};
