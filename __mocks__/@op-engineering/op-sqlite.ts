// Jest stand-in for the native op-sqlite module. Opening fails, so code
// under test sees the database as unavailable and takes its keychain path.
// Tests of the database layer replace open() with a node:sqlite adapter.
export const open = jest.fn(() => {
    throw new Error('op-sqlite is not available in tests');
});
