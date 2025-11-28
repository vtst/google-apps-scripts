var $M = $M || {};
$M.sync = {};

// This class allows to synchronize a target directory with a source directory by
// applying a diff (computed by a $M.Differ). 
$M.Syncer = class {

  constructor(driveApi, logger, options) {
    this._driveApi = driveApi;
    this._logger = logger;
    this._options = options;
    this._newNameSuffix = '_' + (new Date).toISOString();
  }

  _applyDiffRecOnFolders(diff, path) {
    $M.utils.forEachValueKey(diff.children, (childDiff, name) => {
      this._applyDiffRec(childDiff, path + '/' + name, diff.target);
    });
  }

  _getNewName(name) {
    return name + this._newNameSuffix;
  }

  _applyDiffRec(diff, path, targetParent) {
    if (diff.source && diff.target) {
      if (diff.sourceIsFolder && diff.targetIsFolder) {
        this._applyDiffRecOnFolders(diff, path);
      } else if (!diff.same) {
        this._driveApi.syncNode(
          diff.target,
          this._options.rename && (diff.sourceIsFolder || diff.targetIsFolder) ? this._getNewName(diff.source.name) : null,
          diff.source,
          targetParent
        );
      }
    } else if (diff.source) {
      this._driveApi.syncNode(
        null,
        null,
        diff.source,
        targetParent
      );
    } else if (diff.target) {
      if (this._options.remove) {
        this._driveApi.syncNode(
          diff.target,
          null,
          null,
          null
        );
      }
    }
  }

  applyDiffs(diffs) {
    this._driveApi.syncStart();
    for (const diff of diffs) {
      if (!diff.sourceIsFolder) throw new Error('Source is not a folder.');
      if (!diff.targetIsFolder) throw new Error('Target is not a folder.');
      this._applyDiffRecOnFolders(diff, '');
    }
    return this._driveApi.syncEnd();    
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
  let driveApi = options.useBatchApi ? new $M.drive.BatchDriveApi(logger) : new $M.drive.AdvancedDriveServiceApi(logger);
  const directory = opt_directory || new $M.DirectoryBuilder(driveApi, logger).addSubTrees(folderIds).build();
  let numberOfErrors = 0;
  try {
    // Diffing.
    const differ = new $M.Differ();
    const diffs = $M.utils.mapFilter(syncPairs, syncPair => {
      const source = directory.getFileById(syncPair.sourceFolderId);
      const target = directory.getFileById(syncPair.targetFolderId);
      if ($M.files.hasLoop(source)) {
        logger.error(`Found an infinite loop in the descendants of "${source.id}"`);
        ++numberOfErrors;
      } else {
        return differ.diff(source, target);
      }
    });
    // Syncing.
    const syncer = new $M.Syncer(driveApi, logger, options);
    if (options.dryRun) driveApi = new $M.drive.MockDriveApi(logger);
    const counters = syncer.applyDiffs(diffs);
    counters.error += numberOfErrors;
    // Reporting errors.
    logger.info(counters.toString());
    if (counters.error === 0) {
      logger.info('Sync successful.');
      return true;
    } else {
      const message = `${counters.error} error(s) occurred during sync.`;
      logger.error(message);
      if (!options.muteExceptions) throw new Error(message);
      return false;
    }
  } finally {
    logger.close();
  }
};
