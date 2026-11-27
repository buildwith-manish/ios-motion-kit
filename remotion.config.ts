import {Config} from '@remotion/cli/config';

// PNG frames: no JPEG artifacts or banding in dark gradients.
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
