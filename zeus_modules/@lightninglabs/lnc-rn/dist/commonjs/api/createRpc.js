"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createRpc = createRpc;
exports.default = void 0;
var _lncCore = require("@lightninglabs/lnc-core");
// capitalize the first letter in the string
const capitalize = s => s && s[0].toUpperCase() + s.slice(1);

/**
 * Creates a typed Proxy object which calls the request or subscribe
 * methods depending on which function is called on the object
 */
function createRpc(packageName, lnc) {
  const rpc = {};
  return new Proxy(rpc, {
    get(target, key, c) {
      const methodName = capitalize(key.toString());
      // the full name of the method (ex: lnrpc.Lightning.OpenChannel)
      const method = `${packageName}.${methodName}`;
      if (_lncCore.subscriptionMethods.includes(method)) {
        // call subscribe for streaming methods
        return request => {
          return lnc.subscribe(method, request);
        };
      } else {
        // call request for unary methods
        return async request => {
          return await lnc.request(method, request);
        };
      }
    }
  });
}
var _default = createRpc;
exports.default = _default;
//# sourceMappingURL=createRpc.js.map