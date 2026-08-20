module.exports = {
  // Use plain jest (not jest-expo) for pure logic tests
  testEnvironment: "node",
  testMatch: [
    "**/__tests__/*Logic.test.ts", // Pure logic tests only
  ],
  testPathIgnorePatterns: ["/node_modules/"],
  transform: {
    // preset-env compiles the import statements: without it a test can only
    // re-declare the logic it claims to cover, never import the real module.
    "^.+\\.tsx?$": [
      "babel-jest",
      {
        presets: [
          ["@babel/preset-env", { targets: { node: "current" } }],
          "@babel/preset-typescript",
        ],
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};
