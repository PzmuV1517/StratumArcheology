/**
 * Harris Matrix Component Exports
 *
 * Platform-specific implementations are automatically resolved by the bundler:
 * - HarrisMatrix.web.tsx for web platform
 * - HarrisMatrix.native.tsx for iOS/Android
 */

import { Platform } from 'react-native';

// Re-export with platform resolution
// Note: The bundler (Metro/webpack) handles .web.tsx and .native.tsx extensions
// This file serves as a TypeScript type reference

 
const HarrisMatrix = Platform.select({
  web: () => require('./HarrisMatrix.web').default,
  default: () => require('./HarrisMatrix.native').default,
})?.();

export default HarrisMatrix;
export { getHarrisMatrixHTML } from './HarrisMatrixHTML';
