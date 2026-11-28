import React from 'react';
import {Atmosphere} from '../background';
import {Finish} from '../finish';
import {TransitionScene} from '../transitions';
import {ThemeProvider} from '../tokens/ThemeProvider';
import type {Theme} from '../tokens';
import {
  Comparison,
  EndCard,
  Hook,
  MapHero,
  NeededVsEarned,
  Ranking,
  StatCard,
  Takeaway,
} from './templates';
import {ChoroplethScene, FlyToCityScene, RegionHighlightScene} from './mapTemplates';
import {layoutSceneSequence} from './sequence';
import type {SceneDefinition, ScenePlacement, SceneSequenceOptions, SceneSequenceRenderOptions} from './types';

export interface SceneSequenceProps extends SceneSequenceOptions, SceneSequenceRenderOptions {
  frame: number;
  theme: Theme;
  scenes: readonly SceneDefinition[];
}

const SceneTemplate: React.FC<{frame: number; theme: Theme; placement: ScenePlacement}> = ({frame, theme, placement}) => {
  const {scene, start} = placement;
  switch (scene.type) {
    case 'hook':
      return <Hook frame={frame} start={start} theme={theme} title={scene.title} eyebrow={scene.eyebrow} body={scene.body} />;
    case 'stat':
      return <StatCard frame={frame} start={start} theme={theme} label={scene.label} value={scene.value} from={scene.from} format={scene.format} prefix={scene.prefix} suffix={scene.suffix} decimals={scene.decimals} delta={scene.delta} />;
    case 'ranking':
      return <Ranking frame={frame} start={start} theme={theme} title={scene.title} data={scene.data} highlight={scene.highlight} />;
    case 'comparison':
      return <Comparison frame={frame} start={start} theme={theme} title={scene.title} left={scene.left} right={scene.right} format={scene.format} prefix={scene.prefix} suffix={scene.suffix} decimals={scene.decimals} />;
    case 'neededVsEarned':
      return <NeededVsEarned frame={frame} start={start} theme={theme} title={scene.title} data={scene.data} />;
    case 'takeaway':
      return <Takeaway frame={frame} start={start} theme={theme} title={scene.title} eyebrow={scene.eyebrow} body={scene.body} />;
    case 'endCard':
      return <EndCard frame={frame} start={start} theme={theme} title={scene.title} subtitle={scene.subtitle} actionLabel={scene.actionLabel} />;
    case 'mapHero':
      return <MapHero frame={frame} start={start} theme={theme} title={scene.title} subtitle={scene.subtitle} origin={scene.origin} destination={scene.destination} />;
    case 'choropleth':
      return <ChoroplethScene frame={frame} start={start} theme={theme} scene={scene} />;
    case 'regionHighlight':
      return <RegionHighlightScene frame={frame} start={start} theme={theme} scene={scene} />;
    case 'flyToCity':
      return <FlyToCityScene frame={frame} start={start} theme={theme} scene={scene} />;
  }
};

const SceneLayer: React.FC<{
  frame: number;
  theme: Theme;
  placement: ScenePlacement;
  defaultAtmosphere?: SceneSequenceProps['atmosphere'];
}> = ({frame, theme, placement, defaultAtmosphere}) => {
  const preset = placement.scene.atmosphere === undefined ? defaultAtmosphere : placement.scene.atmosphere;
  const content = <SceneTemplate frame={frame} theme={theme} placement={placement} />;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: theme.colors.background.deep}}>
      {preset ? <Atmosphere frame={frame} preset={preset} quiet theme={theme}>{content}</Atmosphere> : content}
    </div>
  );
};

export const SceneSequence: React.FC<SceneSequenceProps> = ({
  frame,
  theme,
  scenes,
  transitionDuration,
  transitionKind,
  atmosphere,
  finish,
  kitRender,
}) => {
  const {placements} = layoutSceneSequence(scenes, {transitionDuration, transitionKind});
  const time = frame / theme.canvas.fps;
  const transitionPlacement = placements.find(({transition}) => transition && time >= transition.start && time < transition.start + transition.duration);
  let content: React.ReactNode;

  if (transitionPlacement?.transition) {
    const index = placements.indexOf(transitionPlacement);
    const incoming = placements[index + 1];
    if (!incoming) throw new Error(`Missing incoming scene after "${transitionPlacement.scene.id}"`);
    const transition = transitionPlacement.transition;
    content = (
      <TransitionScene
        frame={frame}
        theme={theme}
        kind={transition.kind}
        start={transition.start}
        duration={transition.duration}
        response={transition.response}
        curve={transition.curve}
        motionBlur={transition.motionBlur}
        outgoing={<SceneLayer frame={frame} theme={theme} placement={transitionPlacement} defaultAtmosphere={atmosphere} />}
        incoming={<SceneLayer frame={frame} theme={theme} placement={incoming} defaultAtmosphere={atmosphere} />}
      />
    );
  } else {
    const placement = placements.find(({start, end}) => time >= start && time < end) ?? (time < placements[0].start ? placements[0] : placements[placements.length - 1]);
    content = <SceneLayer frame={frame} theme={theme} placement={placement} defaultAtmosphere={atmosphere} />;
  }

  const framed = <div style={{position: 'absolute', inset: 0, width: theme.canvas.width, height: theme.canvas.height, overflow: 'hidden', background: theme.colors.background.deep}}>{content}</div>;
  const finished = finish && finish !== 'off'
    ? <Finish level={finish} finalOnly kitRender={kitRender}>{framed}</Finish>
    : framed;

  return <ThemeProvider theme={theme}>{finished}</ThemeProvider>;
};
