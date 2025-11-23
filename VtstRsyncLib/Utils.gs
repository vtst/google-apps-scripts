var $M = $M || {};
$M.utils = {};

$M.utils.compare = (x, y) => {
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
};

$M.utils.makeDictFromValues = (arr, keyFn, opt_context) => {
  const dict = {};
  for (const item of arr) {
    dict[keyFn.call(opt_context, item)] = item;
  }
  return dict;
};

$M.utils.makeDictFromKeys = (arr, valueFn, opt_context) => {
  const dict = {};
  for (const key of arr) {
    dict[key] = valueFn.call(opt_context, key);
  }
  return dict;
};

$M.utils.mapFilter = (arr, fn, opt_context) => {
  const result = [];
  arr.forEach((item, index) => {
    const x = fn.call(opt_context, item, index);
    if (x) result.push(x);
  });
  return result;
};

$M.utils.forEachValueKey = (obj, fn, opt_context) => {
  for (const key in obj) {
    fn.call(opt_context, obj[key], key);
  }
};

$M.utils.uniqueSort = (arr) => {
  if (arr.length > 0) {
    arr.sort();
    let writeIndex = 0;
    for (let readIndex = 1; readIndex < arr.length; ++readIndex) {
      if (arr[readIndex] !== arr[writeIndex]) {
        ++writeIndex;
        arr[writeIndex] = arr[readIndex];
      }
    }
    arr.length = writeIndex + 1;
  }
  return arr;
};