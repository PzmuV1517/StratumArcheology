module.exports = {
  dependencies: {
    // Disable native autolinking for the npm-linked liquid-react package.
    // All native files are already included in modules/liquid-react (the Expo module),
    // so linking the node_modules version would cause duplicate symbol errors.
    "liquid-react": {
      platforms: {
        ios: null,
        android: null,
      },
    },
  },
};
