var $M = $M || {};
$M.sync = {};

$M.sync.Syncer = class {

  constructor(logger, options) {
    this._logger = logger;
    this._options = options;
    this._numberOfErrors = 0;
    this._renameAndRemoveQueue = $M.drive.newBatchRequestQueue();
    this._createFolderQueue = $M.drive.newBatchRequestQueue();
    this._fileCopyQueue = $M.drive.newBatchRequestQueue();
  }

  _error(path, message) {
    this._logger.error(`${path || '/'}: ${message}`);
    ++this._numberOfErrors;
  }

  _pushActionForRenameOrRemove(action) {
    this._renameAndRemoveQueue.push(
      action.targetNewName ?
        $M.drive.renameFileRequest(action.targetFile.id, action.targetNewName) :
        $M.drive.removeFileRequest(action.targetFile.id),
      response => {
        if (response.error) {
          this._logger.error(
            path, `${action.targetNewName ? 'Renaming' : 'Removing'} target file "${action.targetFile.id}" failed: ${response.error.message}`);
        } else {
          this._pushActionForCopy(action);
        }
      });
  }

  _pushActionForCopy(action) {
    if (action.sourceFile) {
      this._pushCopy(action.sourceFile, action.targetParent);
    }
  }

  _pushCopy(sourceFile, targetParent) {
    if ($M.drive.isFolder(sourceFile)) {
      this._createFolderQueue.push(
        $M.drive.createFolderRequest(targetParent.id, sourceFile.name),
        response => {
          if (response.error) {
            this._logger.error(
              path, `Creating folder "${sourceFile.name}" in "${targetParent.id}" failed: ${response.error.message}`);
          } else {
            // response is the new target folder.
            sourceFile.children.forEach(child => {
              this._pushCopy(child, response);
            });
          }
        });
    } else {
      this._fileCopyQueue.push(
        $M.drive.copyFileRequest(sourceFile, targetParent.id),
        response => {
          if (response.error) {
            this._logger.error(
              path, `Copying source file "${sourceFile.id}" to "${targetParent.id}" failed: ${response.error.message}`);
          }
        });
    }
  }

  sync(actions) {
    for (const action of actions) {
      if (action.targetFile) {
        this._pushActionForRenameOrRemove(action);
      } else {
        this._pushActionForCopy(action);
      }
    }
    this._renameAndRemoveQueue.run();
    this._createFolderQueue.run();
    this._fileCopyQueue.run();
  }
}

// TODO: We should scan each pair separately, so that we can discard its actions if it fails.
$M.sync.sync = (syncEntries, opt_options) => {
  const options = opt_options || {};
  const logger = VtstLoggingLib.createLogger({ output: 'console', level: options.logging?.level });
  const scanner = new $M.scan.Scanner(logger, options);
  const actions = scanner.scan(syncEntries);
  // TODO: what to do if errors?
  actions.sort((action1, action2) => action1.path.localeCompare(action2.path));
  if (options.dryRun) {
    logger.info('\n' + actions.map($M.scan.actionToString).join('\n'));
  } else {
    // TODO: We should log something.
    const syncer = new $M.sync.Syncer(logger, options);
    syncer.sync(actions);
  }
  // TODO: what to do if errors?
};
