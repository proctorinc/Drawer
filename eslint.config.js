//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config';

export default [
  ...tanstackConfig,
  // Node-only build scripts sit outside the app's tsconfig
  { ignores: ['scripts/**'] },
];
