// Shim for the deprecated `domexception` npm package.
// Node 17+ ships globalThis.DOMException natively.
module.exports = globalThis.DOMException;
