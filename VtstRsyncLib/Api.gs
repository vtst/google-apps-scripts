function newDirectory() {
  return new $M.DirectoryBuilder;
}

// Options:
// - rename: rename files in targets when they are to be replaced by a folder rather than deleting them, and similarly for folders replaced by files.
// - delete: delete files and folders in target that do not exist in source.
// - logging.level: error, warning or info
// - dryRun: boolean
// - muteExceptions: for not throwing an error at the end of the sync if it's not complete. In this case, the function returns the number of errors.
function syncFolders(sourceFolderId, targetFolderId, options, opt_directory) {
  $M.sync.syncFolders(sourceFolderId, targetFolderId, options, opt_directory);
}

function multipleSyncFolders(syncPairs, options, opt_directory) {
  $M.sync.multipleSyncFolders(syncPairs, options);
}

function driveFilesListAllPages(optionalArgs, opt_pageSize) {
  return $M.files.listAllPages(optionalArgs, opt_pageSize);
}