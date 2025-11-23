var $M = $M || {};
$M.utils = {};

$M.utils.makeDict = (arr, keyFn, opt_context) => {
  const dict = {};
  for (const item of arr) {
    dict[keyFn.call(opt_context, item)] = item;
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

$M.utils.objectForEach = (obj, fn, opt_context) => {
  for (const key in obj) {
    fn.call(opt_context, obj[key], key);
  }
};
