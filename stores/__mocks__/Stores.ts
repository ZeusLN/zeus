// Manual mock, used by tests that call jest.mock('../stores/Stores') without
// a factory. Importing the real module constructs every store. Tests that need
// more state can assign to these objects, or pass their own factory instead.
export const settingsStore: any = { settings: {} };
export const nodeInfoStore: any = { nodeInfo: {} };
