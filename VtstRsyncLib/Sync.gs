var $M = $M || {};
$M.sync = {};

// This class allows to synchronize a target directory with a source directory by
// applying a diff (computed by a $M.Differ). 
$M.Syncer = class {

  constructor(driveApi, logger, directory, options) {
    this._driveApi = driveApi;
    this._logger = logger;
    this._directory = directory;
    this._options = options;
    this._newNameSuffix = '_' + (new Date).toISOString();
  }

  _applyDiffRecOnFolders(diff, path) {
    $M.utils.forEachValueKey(diff.children, (childDiff, name) => {
      this._applyDiffRec(childDiff, path + '/' + name, diff.sourceId, diff.targetId);
    });
  }

  _getNewName(name) {
    return name + this._newNameSuffix;
  }

  _copySubTree(root, rootParentTargetFolder) {
    let success = true;
    this._directory.forEachDownwards(root, (file, targetParentFolder) => {
      if (targetParentFolder) {
        if ($M.drive.isFolder(file)) {
          return this._driveApi.createFolder(targetParentFolder, file.name);
        } else {
          this._driveApi.copyFile(file, targetParentFolder);
        }
      }
    }, rootParentTargetFolder);
    return success;
  }

  _applyDiffRec(diff, path, sourceParentId, targetParentId) {
    const source = this._directory.getFileById(diff.sourceId);
    const target = this._directory.getFileById(diff.targetId);
    if (diff.sourceExists && diff.targetExists) {
      if (diff.sourceIsFolder && diff.targetIsFolder) {
        this._applyDiffRecOnFolders(diff, path);
      } else if (!diff.same) {
        if (this._options.rename && (diff.sourceIsFolder || diff.targetIsFolder)) {
          this._logger.info(`Renaming "${diff.targetId}" (${path})`);
          this._driveApi.renameFile(target, this._getNewName(source.name));
        } else {
          this._logger.info(`Removing "${diff.targetId}" (${path})`);
          this._driveApi.removeFile(target);
        }
        if (targetIsFree) {
          this._logger.info(`Copying "${diff.sourceId}" (${path}) into "${targetParentId}"`);
          this._copySubTree(source, this._directory.getFileById(targetParentId));  // we should have targetParent.
        } else {
          this._logger.warn(`Could not copy "${diff.sourceId}" (${path}) into "${targetParentId}" because previous renaming/removing failed.`);
        }
      }
    } else if (diff.sourceExists) {
      this._logger.info(`Copying "${diff.sourceId}" (${path}) into "${targetParentId}"`);
      this._copySubTree(source, this._directory.getFileById(targetParentId));  // we should have targetParent.
    } else if (diff.targetExists) {
      if (this._options.remove) {
        this._logger.info(`Removing "${diff.targetId}" (${path})`);
        this._driveApi.removeFile(target);
      }
    }
  }

  applyDiff(diff) {
    if (!diff.sourceIsFolder) throw new Error('Source is not a folder.');
    if (!diff.targetIsFolder) throw new Error('Target is not a folder.');
    this._applyDiffRecOnFolders(diff, '');
  }

};

// Main function to sync two folders.
$M.sync.syncFolders = (sourceFolderId, targetFolderId, options, opt_directory) => {
  return $M.sync.multipleSyncFolders([{sourceFolderId, targetFolderId}], options, opt_directory);
};

// Main function to sync set of pairs {sourceFolderId, targetFolderId} folders.
$M.sync.multipleSyncFolders = (syncPairs, options, opt_directory) => {
  const folderIds = syncPairs.map(syncPair => ([syncPair.sourceFolderId, syncPair.targetFolderId])).flat();
  const logger = VtstLoggingLib.createLogger({output: 'console', level: options.logging?.level});
  let driveApi = options.useBatchApi ? new $M.drive.BatchDriveApi : new $M.drive.AdvancedDriveServiceApi;
  const directory = opt_directory || new $M.DirectoryBuilder(driveApi, logger).addSubTrees(folderIds).build();
  try {
    const differ = new $M.Differ(directory);
    if (options.dryRun) driveApi = new $M.drive.MockDriveApi(logger);
    const syncer = new $M.Syncer(driveApi, logger, directory, options);
    for (const syncPair of syncPairs) {
      const diff = differ.diff(syncPair.sourceFolderId, syncPair.targetFolderId);
      syncer.applyDiff(diff);
    }
    // if (driveOperator.numberOfErrors === 0) {
    //   logger.info('Sync successful.');
    // } else {
    //   const message = `${driveOperator.numberOfErrors} error(s) occurred during sync.`;
    //   logger.error(message);
    //   if (!options.muteExceptions) throw new Error(message);
    // }
    // return driveOperator.numberOfErrors;
  } finally {
    logger.close();
  }
};
