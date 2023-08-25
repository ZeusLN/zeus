"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {};
exports.default = void 0;
var _lnc = _interopRequireDefault(require("./lnc"));
var _lncCore = require("@lightninglabs/lnc-core");
Object.keys(_lncCore).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _lncCore[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _lncCore[key];
    }
  });
});
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
var _default = _lnc.default;
exports.default = _default;
//# sourceMappingURL=index.js.map