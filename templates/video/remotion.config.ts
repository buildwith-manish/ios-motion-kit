import path from 'node:path';
import {Config} from '@remotion/cli/config';

// PNG frames: no JPEG artifacts or banding in dark gradients.
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
// Map tiles, fonts and big data can be slow on a CI runner: give delayRender room.
Config.setDelayRenderTimeoutInMilliseconds(120000);
// `import ... from 'ios-motion-kit'` resolves to the kit submodule (tsconfig.json has the matching path).
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {...(config.resolve?.alias ?? {}), 'ios-motion-kit': path.resolve(process.cwd(), 'kit/src/kit')},
  },
}));
