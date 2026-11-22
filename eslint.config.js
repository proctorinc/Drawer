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
  {
    // The browser's own confirm and alert boxes look nothing like the app
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'confirm',
          message: 'Use useConfirm() from @/components/Confirm instead.',
        },
        {
          name: 'alert',
          message: 'Use useAlert() from @/components/Confirm instead.',
        },
      ],
      'no-restricted-properties': [
        'error',
        ...['window', 'globalThis', 'self'].flatMap((object) => [
          {
            object,
            property: 'confirm',
            message: 'Use useConfirm() from @/components/Confirm instead.',
          },
          {
            object,
            property: 'alert',
            message: 'Use useAlert() from @/components/Confirm instead.',
          },
        ]),
      ],
    },
  },
];
