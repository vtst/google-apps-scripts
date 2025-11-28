// Build a tree of files from Google Drive.

var $M = $M || {};
$M.files = {};

// ********************************************************************************
// Utility functions for the Drive API.

$M.files.getSharedDriveRoot = (driveId) => {
  const root = Drive.Drives.get(driveId, {
    fields: 'id,name',
    supportsAllDrives: true
  });
  root.mimeType = $M.drive.FOLDER_MIME_TYPE;
  return root;
};

// ********************************************************************************
// Directory

// A class to build a directory.
$M.DirectoryBuilder = class {

  constructor(driveApi, logger) {
    this._driveApi = driveApi;
    this._files = [];
    this._filesById = {};
    this._fields = 'id,name,parents,size,modifiedTime,mimeType,trashed';
    this._logger = logger;
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

  _listAllPages(params, opt_pageSize) {
    if (!params.pageSize) params.pageSize = $M.drive.PAGE_SIZE;
    params.pageToken = undefined;
    params.fields = params.fields ? 'nextPageToken,' + params.fields : 'nextPageToken';
    const files = [];
    do {
      const response = this._driveApi.listFiles(params);
      if (response.files) files.push(... response.files);
      params.pageToken = response.nextPageToken;
    } while (params.pageToken);
    return files;
  };

  // Add all files from "My Drive" to the directory.
  addMyDrive() {
    this._pushFiles(this._listAllPages({
      q: 'trashed = false',
      fields: `files(${this._fields})`,
      corpora: 'user'
    }));
    // Add the root which is not returned by Files.list.
    const root = this._driveApi.getFile('root', this._fields);
    this._pushFile(root);
    this._filesById['root'] = root;
    return this;
  }

  // Add all files from a shared drive to the directory.
  addSharedDrive(driveId) {
    this._pushFiles(this._listAllPages({
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

  addSubTrees(fileIds) {
    this._driveApi.walkSubTrees(fileIds, this._fields, file => !(this._pushFile(file)));
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
      if ($M.drive.isFolder(file)) {
        file._children = [];
        file._childrenByName = {};
      }
    }
    for (const file of this._files) {
      file._parents = $M.utils.mapFilter(file.parents || [], parentId => {
        const parent = this._filesById[parentId];
        if (parent) {
          parent._children.push(file);
          parent._childrenByName[file.name] = file;
          return parent;
        }
      });
    }
  }

  getFileById(id) {
    return this._filesById[id];
  }
  
};


// ********************************************************************************
// File tree functions

// Apply fn on rootFile and every descendant of root file, from top to bottom.
// The value returned by fn on a node is passed to its children as the context argument.
// Note: This function does not terminate if there is a loop somewhere in the graph.
$M.files.forEachDownwards = (rootFile, fn, context, opt_obj) => {
  const contextForChildren = fn.call(opt_obj, rootFile, context);
  if (rootFile._children) {
    for (const child of rootFile._children) {
      $M.files.forEachDownwards(child, fn, contextForChildren, opt_obj);
    }
  }
}

// Apply fn on rootFile and every descendant of root file, from bottom to top.
// The values returned by fn on the children of a node are passed as argument to fn
// as an array when fn is called on the node.
// Note: This function does not terminate if there is a loop somewhere in the graph.
$M.files.forEachUpwards = (rootFile, fn, opt_obj) => {
  const childrenResults = rootFile._children ? rootFile._children.map(child => ($M.files.forEachUpwards(child, fn, opt_obj))) : [];
  return fn.call(opt_obj, rootFile, childrenResults);
}

// Return a pretty-print of a sub-tree into a string.
$M.files.printSubTree = (rootFile) => {
  const lines = [];
  $M.files.forEachDownwards(rootFile, (file, {depth}) => {
    lines.push('  '.repeat(depth) + file.name);
    return {depth: depth + 1};
  }, {depth: 0});
  return lines.join('\n');
}

// Return true if there is a loop encountered when walking in the sub-tree of
// rootFile descendants.
$M.files.hasLoop = (rootFile) => {
  const visitedFiles = new Set;
  const walk = (file) => {
    if (!file) return false;
    if (visitedFiles.has(file.id)) return true;
    visitedFiles.add(file.id);
    if (visitedFiles._children) {
      return visitedFiles._children.some(child => (walk(child)));
    } else {
      return false;
    }
  }
  return walk(rootFile);
};
