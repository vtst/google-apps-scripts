var $M = $M || {};
$M.sync = {};

$M.Syncer = class {

  constructor(driveOperator, logger, directory, options) {
    this._driveOperator = driveOperator;
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

  _applyDiffRec(diff, path, sourceParentId, targetParentId) {
    const source = this._directory.getFileById(diff.sourceId);
    const target = this._directory.getFileById(diff.targetId);
    if (diff.sourceExists && diff.targetExists) {
      if (diff.sourceIsFolder && diff.targetIsFolder) {
        this._applyDiffRecOnFolders(diff, path);
      } else {
        if (this._options.rename) {
          this._logger.info(`Renaming "${diff.targetId}" (${path})`);
          this._driveOperator.rename(source, this._getNewName(source));
        } else {
          this._logger.info(`Removing "${diff.targetId}" (${path})`);
          this._driveOperator.removeRec(target);
        }
        this._logger.info(`Copying "${diff.sourceId}" (${path}) into "${targetParentId}"`);
        this._driveOperator.copyRec(source, this._directory.getFileById(targetParentId));  // we should have targetParent.
      }
    } else if (diff.sourceExists) {
      this._logger.info(`Copying "${diff.sourceId}" (${path}) into "${targetParentId}"`);
      this._driveOperator.copyRec(source, this._directory.getFileById(targetParentId));  // we should have targetParent.
    } else if (diff.targetExists) {
      if (this._options.remove) {
        this._logger.info(`Removing "${diff.targetId}" (${path})`);
        this._driveOperator.removeRec(target);
      }
    }
  }

  applyDiff(diff) {
    if (!diff.sourceIsFolder) throw new Error('Source is not a folder.');
    if (!diff.targetIsFolder) throw new Error('Target is not a folder.');
    this._applyDiffRecOnFolders(diff, '');
  }

};

$M.diff.syncFolders = (sourceFolderId, targetFolderId, options) => {
  const directory = newDirectory().addSubTrees([sourceFolderId, targetFolderId]).build();
  const logger = new $M.logging.ConsoleLogger();
  const differ = new $M.Differ(directory);
  const diff = differ.diff(sourceFolderId, targetFolderId);
  const driveOperator = new $M.drive.DriveOperator(directory, new $M.drive.MockDriveApi(logger), logger, true);
  const syncer = new $M.Syncer(driveOperator, logger, directory, options);
  syncer.applyDiff(diff)
};