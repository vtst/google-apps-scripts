function _gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  if (a === 0) return b;
  if (b === 0) return a;
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

function _deepEquals(obj1, obj2) {
  const t = typeof obj1;
  if (t !== typeof obj2) return false;
  if (t === 'object') {
    for (var key in obj1) {
      if (!_deepEquals(obj1[key], obj2[key])) return false;
    }
    for (var key in obj2) {
      if (!(key in obj1)) return false;
    }
    return true;
  } else {
    return obj1 === obj2;
  }
}