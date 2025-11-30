// Options:
// - rename (boolean): rename files in targets when they are to be replaced by a folder rather than deleting them,
//   and similarly for folders replaced by files.
// - remove (boolean): delete files and folders in target that do not exist in source.
// - logging.level (string): error, warning or info
// - dryRun (boolean): run the diff but does not perform changes.
// - verbose (boolean): Include all nodes of the file tree, including intermediate nodes and nodes with no changes.
function syncFolders(sourceFolderId, targetFolderId, options) {
  $M.sync.sync([{ sourceId: sourceFolderId, targetId: targetFolderId, name: '.' }], options);
}

function multipleSyncFolders(folderPairs, options) {
  $M.sync.sync(folderPairs, options);
}

function driveFilesListAllPages(optionalArgs, opt_pageSize) {
  return $M.files.listAllPages(optionalArgs, opt_pageSize);
}