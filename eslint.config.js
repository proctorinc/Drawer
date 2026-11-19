//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config';

export default [
  ...tanstackConfig,
  // Node-only build scripts and the plain-JS service worker sit outside the app's tsconfig
  { ignores: ['scripts/**', 'public/**'] },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
