// Jest setup file
// Configure testing environment

// Mock expo-sqlite for testing (virtual mock for modules not installed)
jest.mock(
  "expo-sqlite",
  () => ({
    openDatabaseSync: jest.fn(() => ({
      execSync: jest.fn(),
      runSync: jest.fn(() => ({ lastInsertRowId: 1 })),
      getFirstSync: jest.fn(),
      getAllSync: jest.fn(() => []),
    })),
  }),
  { virtual: true },
);

// Mock NetInfo (virtual mock)
jest.mock(
  "@react-native-community/netinfo",
  () => ({
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() =>
      Promise.resolve({
        type: "wifi",
        isConnected: true,
        isInternetReachable: true,
      }),
    ),
  }),
  { virtual: true },
);

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}));

// Silence warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
