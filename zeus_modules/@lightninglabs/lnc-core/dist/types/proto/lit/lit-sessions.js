"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionState = exports.SessionType = void 0;
/* eslint-disable */
var SessionType;
(function (SessionType) {
    SessionType["TYPE_MACAROON_READONLY"] = "TYPE_MACAROON_READONLY";
    SessionType["TYPE_MACAROON_ADMIN"] = "TYPE_MACAROON_ADMIN";
    SessionType["TYPE_MACAROON_CUSTOM"] = "TYPE_MACAROON_CUSTOM";
    SessionType["TYPE_UI_PASSWORD"] = "TYPE_UI_PASSWORD";
    SessionType["TYPE_AUTOPILOT"] = "TYPE_AUTOPILOT";
    SessionType["TYPE_MACAROON_ACCOUNT"] = "TYPE_MACAROON_ACCOUNT";
    SessionType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(SessionType = exports.SessionType || (exports.SessionType = {}));
var SessionState;
(function (SessionState) {
    SessionState["STATE_CREATED"] = "STATE_CREATED";
    SessionState["STATE_IN_USE"] = "STATE_IN_USE";
    SessionState["STATE_REVOKED"] = "STATE_REVOKED";
    SessionState["STATE_EXPIRED"] = "STATE_EXPIRED";
    SessionState["STATE_RESERVED"] = "STATE_RESERVED";
    SessionState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(SessionState = exports.SessionState || (exports.SessionState = {}));
