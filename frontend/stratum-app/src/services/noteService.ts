// Cross-platform note service entry point
// Metro bundler will resolve to the correct platform-specific file

import { Platform } from 'react-native';

// Re-export types from core
export * from './noteService.core';

// Platform-specific imports
let noteService: any;

if (Platform.OS === 'web') {
  noteService = require('./noteService.web').noteService;
} else {
  noteService = require('./noteService.native').noteService;
}

export { noteService };
export default noteService;
