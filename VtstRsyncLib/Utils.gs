var $M = $M || {};
$M.utils = {};

$M.utils.array = {};

$M.utils.array.forEach2 = (arr1, arr2, fn, opt_obj) => {
  const n = Math.max(arr1.length, arr2.length);
  for (let i = 0; i < n; ++i) {
    fn.call(opt_obj, arr1[i], arr2[i], i);
  }
};

$M.utils.object = {};

$M.utils.object.forEach2 = (obj1, obj2, fn, opt_obj) => {
  for (let key in obj1) {
    fn.call(opt_obj, obj1[key], obj2[key], key);
  }
  for (let key in obj2) {
    if (!(key in obj1)) fn.call(opt_obj, undefined, obj2[key], key);
  }
};
