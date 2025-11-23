var $M = $M || {};
$M.sync = {};

$M.Syncer = class {

  constructor(driveApi, directory, options) {
    this._driveApi = driveApi;
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
      }
    } else if (diff.sourceExists) {

    } else if (diff.targetExists) {

    }
  }

  _applyDiff(diff) {
    if (!diff.sourceIsFolder) throw new Error('Source is not a folder.');
    if (!diff.targetIsFolder) throw new Error('Target is not a folder.');
    this._applyDiffRecOnFolders(diff, '');
  }

};

$M.sync._applyDiffRec = (diff, sourceParentId, targetParentId, options) => {
  if (diff.sourceExists && diff.targetExists) {

  } else if (diff.sourceExists) {

  }
}