import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { StorybookConfig } from '@storybook/react-vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import swc from 'unplugin-swc';
import { mergeConfig } from 'vite';

export default {
  stories: [
    '../src/ui/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
    '../src/components/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'
  ],

  addons: [],

  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {},
  },

  features: {},

  docs: {},

  async viteFinal(config, _options) {
    return mergeConfig(config, {
      plugins: [
        vanillaExtractPlugin(),
        swc.vite({
          jsc: {
            preserveAllComments: true,
            parser: {
              syntax: 'typescript',
              dynamicImport: true,
              tsx: true,
              decorators: true,
            },
            target: 'es2022',
            externalHelpers: false,
            transform: {
              react: {
                runtime: 'automatic',
              },
              useDefineForClassFields: false,
              decoratorVersion: '2022-03',
            },
          },
          sourceMaps: true,
          inlineSourcesContent: true,
        }),
      ],
      define: {
        'BUILD_CONFIG.debug': JSON.stringify(true),
        'BUILD_CONFIG.isElectron': JSON.stringify(false),
        'BUILD_CONFIG.isSelfHosted': JSON.stringify(false),
        'process.env.NODE_ENV': JSON.stringify('development'),
      },
    });
  },

  // typescript: {
  //   reactDocgen: 'react-docgen-typescript',
  // },
} satisfies StorybookConfig;

function getAbsolutePath(value: string): any {
  return dirname(fileURLToPath(import.meta.resolve(join(value, 'package.json'))));
}

