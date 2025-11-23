var $M = $M || {};
$M.diff = {};

$M.diff.fileEquals = (file1, file2) => {
  return file1.size === file2.size &&
    file1.modifiedTime === file2.modifiedTime &&
    file1.mimeType === file2.mimeType;
};

$M.Differ = class {

  constructor(directory, opt_fileEquals) {
    this._directory = directory;
    this._fileEquals = opt_fileEquals || $M.diff.fileEquals;
  }

  diff(sourceId, targetId) {
    const source = this._directory.getFileById(sourceId);
    const target = this._directory.getFileById(targetId);
    const diff = {
      sourceId, targetId,
      sourceExists: source ? true : false,
      targetExists: target ? true : false,
      sourceIsFolder: source && $M.files.isFolder(source),
      targetIsFolder: target && $M.files.isFolder(target),
      same: false
    };
    if (!diff.sourceExists && !diff.targetExists) {
      diff.same = true;
    } else if (diff.sourceIsFolder && diff.targetIsFolder) {
      diff.same = true;
      const names = $M.utils.uniqueSort([... Object.keys(source.childrenByName), ... Object.keys(target.childrenByName)]);
      diff.children = $M.utils.makeDictFromKeys(names, name => (this.diff(source.childrenByName[name], target.childrenByName[name])));
    } else if (!diff.sourceIsFolder && !diff.targetIsFolder && diff.sourceExists && diff.targetExists) {
      diff.same = this._fileEquals(source, target);
    }
    return diff;
  }

};

$M.diff.getLabelForDiff = (diff) => {
  if (diff.sourceExists) {
    if (diff.targetExists) {
      return 'changed';
    } else {
      return 'added';
    }
  } else {
    return 'deleted'
  }
};

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
