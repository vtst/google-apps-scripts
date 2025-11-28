var $M = $M || {};
$M.diff = {};

// Comparison function to test if a file in source and target are identical
$M.diff.fileEquals = (sourceFile, targetFile) => {
   // sourceFile.size === targetFile.size &&  Don't compare sizes as they don't seem to be preserved.
   return sourceFile.modifiedTime === targetFile.modifiedTime &&
    sourceFile.mimeType === targetFile.mimeType;
};

// A Differ is used to compute a diff object to compare two file sub-trees.
// It has a single method diff doing the job.
$M.Differ = class {

  constructor(opt_fileEquals) {
    this._fileEquals = opt_fileEquals || $M.diff.fileEquals;
  }

  diff(source, target) {
    const diff = {
      source, target,
      sourceIsFolder: source && $M.drive.isFolder(source),
      targetIsFolder: target && $M.drive.isFolder(target),
      same: false
    };
    if (!source && !target) {
      diff.same = true;
    } else if (diff.sourceIsFolder && diff.targetIsFolder) {
      diff.same = true;
      const names = $M.utils.uniqueSort([... Object.keys(source._childrenByName), ... Object.keys(target._childrenByName)]);
      diff.children = $M.utils.makeDictFromKeys(names, name => (this.diff(source._childrenByName[name], target._childrenByName[name])));
    } else if (!diff.sourceIsFolder && !diff.targetIsFolder && source && target) {
      diff.same = this._fileEquals(source, target);
    }
    return diff;
  }

};

$M.diff.getLabelForDiff = (diff) => {
  if (diff.source) {
    if (diff.target) {
      return 'changed';
    } else {
      return 'added';
    }
  } else {
    return 'removed'
  }
};

// Pretty print a diff into a string.
$M.diff.print = (rootDiff) => {
  const lines = [];
  const print_ = (diff, path, depth) => {
    const indent = '  '.repeat(depth);
    if (diff.same && diff.children) {
      lines.push(indent + path + '/');
      const children = Object.entries(diff.children);
      children.sort(([name1, diff1], [name2, diff2]) => ($M.utils.compare(name1, name2)));
      for (const [name, childDiff] of children) {
        print_(childDiff, path + '/' + name, depth + 1);
      }
    } else {
      lines.push(`${indent}${path}${diff.sourceIsFolder ? '/' : ''} [${$M.diff.getLabelForDiff(diff)}]`)
    }
  };
  print_(rootDiff, '', 0);
  return lines.join('\n');
};
