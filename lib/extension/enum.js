/**
 * Turns an array into an immutable enum-like object
 */
export function createEnum(anArray) {
  const enumObj = {};
  for (const val of anArray) {
    enumObj[val] = val;
  }
  return Object.freeze(enumObj);
}
