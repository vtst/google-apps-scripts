var $M = $M || {};
$M.sync = {};

$M.Syncer = class {

  constructor(driveApi, logger, directory, options) {
    this._driveApi = driveApi;
    this._logger = logger;
    this._directory = directory;
    this._options = options;
  }

  _applyDiffRecOnFolders(diff, path) {
    $M.utils.forEachValueKey(diff.children, (childDiff, name) => {
      this._applyDiffRec(childDiff, path + '/' + name, diff.sourceId, diff.targetId);
    });
  }

  _applyDiffRec(diff, path, sourceParentId, targetParentId) {
    if (diff.sourceExists && diff.targetExists) {
      if (diff.sourceIsFolder && diff.targetIsFolder) {
        this._applyDiffRecOnFolders(diff, path);
      } else {
        if (this._options.rename) {
          this._logger.info(`Renaming "${diff.targetId}" (${path})`);
        } else {
          this._logger.info(`Removing "${diff.targetId}" (${path})`);
        }
        this._logger.info(`Copying "${diff.sourceId}" (${path}) into "${targetParentId}"`);
      }
    } else if (diff.sourceExists) {
      this._logger.info(`Copying "${diff.sourceId}" (${path}) into "${targetParentId}"`);
    } else if (diff.targetExists) {
      if (this._options.remove) {
        this._logger.info(`Removing "${diff.targetId}" (${path})`);
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
  const syncer = new $M.Syncer(null, logger, directory, options);
  syncer.applyDiff(diff);
};