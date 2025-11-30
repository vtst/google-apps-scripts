var $M = $M || {};
$M.scan = {};

$M.scan.Scanner = class {

  constructor(logger, options) {
    this._logger = logger;
    this._options = options;
    this._newNameSuffix = this._options.rename && ('_' + (new Date).toISOString());
    this._queue = $M.drive.newBatchRequestQueue();
    // Each action may have the following fields:
    // - targetFile: a target file to rename (is targetNewName is set) or remove,
    // - targetNewName,
    // - sourceFile: a source file to copy,
    // - targetParent: the folder into which to copy sourceFile.
    // and for logging purpose only:
    // - path
    // - isFolder
    // - error
    this._actions = [];
    this._numberOfErrors = 0;
  }

  fileDiffer(sourceFile, targetFile) {
    // sourceFile.size !== targetFile.size &&  Don't compare sizes as they don't seem to be preserved.
    return sourceFile.modifiedTime !== targetFile.modifiedTime ||
      sourceFile.mimeType !== targetFile.mimeType;
  }

  _getNewName(targetFile) {
    return this._newNameSuffix && (targetFile.name + this._newNameSuffix);
  }

  _push(action) {
    this._actions.push(action);
  }

  _error(path, message) {
    this._logger.error(`${path || '/'}: ${message}`);
    ++this._numberOfErrors;
    if (this._options.verbose) this._push({ path, error: message });
  }

  _getChildrenByName(children) {
    const childrenByName = {};
    for (const child of children) {
      childrenByName[child.name] = child.name in childrenByName ? 0 : child;
    }
    return childrenByName;
  }

  _scanChildren(path, source, sourceChildren, target, targetChildren) {
    $M.utils.object.forEach2(this._getChildrenByName(sourceChildren), this._getChildrenByName(targetChildren),
      (sourceChild, targetChild, name) => {
        if (sourceChild === 0) {
          this._error(path, `Source folder "${source.id}" has multiple children named "${name}"`);
        } else if (targetChild === 0) {
          this._error(path, `Target folder "${source.id}" has multiple children named "${name}"`);
        } else {
          const name = sourceChild?.name || targetChild?.name;
          this._scanFiles(path + '/' + name, sourceChild, targetChild, target);
        }
      });
  }

  _getDescendants(path, sourceFile) {
    if ($M.drive.isFolder(sourceFile)) {
      this._queue.push(
        $M.drive.getChildrenRequest(sourceFile.id),
        response => {
          if (response.error) {
            this._error(path, `Getting children of source folder "${sourceFile.id}" failed: ${response.error.message}`);
          } else {
            sourceFile.children = response.files;
            for (const child of sourceFile.children) {
              this._getDescendants(path + '/' + child.name, child);
            }
          }
        });
    }
  }

  _scanFolders(path, sourceFile, targetFile) {
    if (this._options.verbose) this._push({ path, isFolder: true });
    this._queue.pushGroup(
      [$M.drive.getChildrenRequest(sourceFile.id), $M.drive.getChildrenRequest(targetFile.id)],
      ([sourceResponse, targetResponse]) => {
        if (sourceResponse.error) {
          this._error(path, `Getting children of source folder "${sourceFile.id}" failed: ${sourceResponse.error.message}`);
        } else if (targetResponse.error) {
          this._error(path, `Getting children of target folder "${targetFile.id}" failed: ${targetResponse.error.message}`);
        } else {
          this._scanChildren(path, sourceFile, sourceResponse.files, targetFile, targetResponse.files);
        }
      });
  }

  _scanFiles(path, sourceFile, targetFile, targetParent) {
    if (sourceFile) {
      if (targetFile) {
        const sourceFileIsFolder = $M.drive.isFolder(sourceFile);
        if (sourceFileIsFolder === $M.drive.isFolder(targetFile)) {
          if (sourceFileIsFolder) {
            // Syncing two folders.
            this._scanFolders(path, sourceFile, targetFile);
          } else {
            // Syncing two files.
            if (this.fileDiffer(sourceFile, targetFile)) {
              this._push({ path, targetFile, sourceFile, targetParent });
            } else if (this._options.verbose) {
              this._push({ path });
            }
          }
        } else {
          // Syncing a file into a folder or a folder into a file.
          this._push({ path, targetFile, targetNewName: this._getNewName(targetFile), sourceFile, targetParent });
          this._getDescendants(path, sourceFile);
        }
      } else {
        // No target file, copying source file.
        this._push({ path, sourceFile, targetParent });
        this._getDescendants(path, sourceFile);
      }
    } else if (targetFile) {
      // No source file, removing target file.
      if (this._options.remove) this._push({ path, targetFile });
    }
  }

  scan(folderPairs) {
    for (const folderPair of folderPairs) {
      this._queue.pushGroup(
        [$M.drive.getFileRequest(folderPair.sourceId), $M.drive.getFileRequest(folderPair.targetId)],
        ([sourceResponse, targetResponse]) => {
          const path = folderPair.name || '';
          if (sourceResponse.error) {
            this._error(path, `Getting root source folder "${folderPair.sourceId}" failed: ${sourceResponse.error.message}`);
          } else if (targetResponse.error) {
            this._error(path, `Getting root target folder "${folderPair.sourceId}" failed: ${targetResponse.error.message}`);
          } else if (!$M.drive.isFolder(sourceResponse)) {
            this._error(path, `Source root "${folderPair.sourceId}" is not a folder`);
          } else if (!$M.drive.isFolder(targetResponse)) {
            this._error(path, `Target root "${folderPair.sourceId}" is not a folder`);
          } else {
            this._scanFolders(path, sourceResponse, targetResponse);
          }
        });
    }
    this._queue.run();
    return this._actions;
  }

};

$M.scan.getLabelForAction = (action) => {
  if (action.error) {
    return 'E';
  } else if (action.sourceFile) {
    if (action.targetFile) {
      return 'M';
    } else {
      return 'A'
    }
  } else if (action.targetFile) {
    return 'D';
  } else if (action.isFolder) {
    return '↳';
  } else {
    return '=';
  }
};

$M.scan.getTrailerForAction = (action) => {
  if (!action.targetFile && action.sourceFile && $M.drive.isFolder(action.sourceFile) && action.sourceFile.children.length > 0) {
    return '/...';
  } else {
    return '';
  }
};

$M.scan.actionToString = (action) => (`${$M.scan.getLabelForAction(action)} ${action.path}${$M.scan.getTrailerForAction(action)}`);
