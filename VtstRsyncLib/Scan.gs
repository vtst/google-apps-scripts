var $M = $M || {};
$M.scan = {};

$M.scan.EntryScanner = class {

  constructor(logger, options, queue) {
    this._logger = logger;
    this._options = options;
    this._newNameSuffix = this._options.rename && ('_' + (new Date).toISOString());
    this._queue = queue;
    // Each action may have the following fields:
    // - targetFile: a target file to rename (is targetNewName is set) or remove,
    // - targetNewName,
    // - sourceFile: a source file to copy,
    // - targetParent: the folder into which to copy sourceFile.
    // and for logging purpose only:
    // - path
    // - isFolder
    // - error
    this.actions = [];
    this.numberOfErrors = 0;
    this._folderIds = new Set;
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
    this.actions.push(action);
  }

  _error(path, message) {
    this._logger.error(`${path || '/'}: ${message}`);
    ++this.numberOfErrors;
    if (this._options.verbose) this._push({ path, error: message });
  }

  _alreadyVisited(path, folder) {
    if (this._folderIds.has(folder.id)) {
      this._error(path, `Source folder "${folder.id}" visited twice. The file tree may have been changed during the scan.`);
      return true;
    } else {
      this._folderIds.add(folder.id);
    }
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
    if ($M.drive.isFolder(sourceFile) && !this._alreadyVisited(path, sourceFile)) {
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
    if (this._alreadyVisited(path, sourceFile)) return;
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

  enqueue(syncEntry) {
    this._queue.pushGroup(
      [$M.drive.getFileRequest(syncEntry.sourceId), $M.drive.getFileRequest(syncEntry.targetId)],
      ([sourceResponse, targetResponse]) => {
        const path = syncEntry.name || '';
        if (sourceResponse.error) {
          this._error(path, `Getting root source folder "${syncEntry.sourceId}" failed: ${sourceResponse.error.message}`);
          if (corporaIncludesSharedDrive) this._error(path, `Trying as a shared drive also failed: ${sourceResponse.error.message}`);
        } else if (targetResponse.error) {
          this._error(path, `Getting root target folder "${syncEntry.targetId}" failed: ${targetResponse.error.message}`);
          if (corporaIncludesSharedDrive) this._error(path, `Trying as a shared drive also failed: ${targetDriveResponse.error.message}`);
        } else if (!$M.drive.isFolder(sourceResponse)) {
          this._error(path, `Source root "${syncEntry.sourceId}" is not a folder`);
        } else if (!$M.drive.isFolder(targetResponse)) {
          this._error(path, `Target root "${syncEntry.targetId}" is not a folder`);
        } else {
          this._scanFolders(path, sourceResponse, targetResponse);
        }
      });
  }

};

$M.scan.scan = (logger, options, syncEntries) => {
  const queue = $M.drive.newBatchRequestQueue();
  const scanners = syncEntries.map(syncEntry => {
    const scanner = new $M.scan.EntryScanner(logger, options, queue);
    scanner.enqueue(syncEntry);
    return scanner;
  });
  queue.run();
  $M.utils.array.forEach2(syncEntries, scanners, (syncEntry, scanner) => {
    if (scanner.numberOfErrors > 0) {
      logger.error(`Scanning of entry "${syncEntry.name || '.'}" had ${scanner.numberOfErrors} error(s).` +
        (options.abortIfScanError ? ' Aborting this entry.' : ''));
    }
  });
  return {
    actions: scanners.map(scanner => ((scanner.numberOfErrors > 0 && options.abortIfScanError) ? [] : scanner.actions)).flat(),
    numberOfErrors: scanners.reduce((acc, scanner) => acc + scanner.numberOfErrors, 0)
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
