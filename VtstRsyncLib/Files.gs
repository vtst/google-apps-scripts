// Build a tree of files from Google Drive.

var $M = $M || {};
$M.files = {};

// ********************************************************************************
// Utility functions for the Drive API.

// A wrapper around Drive.Files.list that support paging.
$M.files.listAllPages = (optionalArgs, opt_pageSize) => {
  if (!optionalArgs.pageSize) optionalArgs.pageSize = $M.drive.PAGE_SIZE;
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
  root.mimeType = $M.drive.FOLDER_MIME_TYPE;
  return root;
};

// ********************************************************************************
// Directory

// A class to build a directory.
$M.DirectoryBuilder = class {

  constructor(driveApi, opt_logger) {
    this._driveApi = driveApi;
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

  // Note: This fails if any folder is deleted while the tree is scanned.
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
