import React from 'react';
import {AbsoluteFill, Audio, Composition, staticFile, useCurrentFrame} from 'remotion';
import {
  CANVAS,
  CueTrack,
  MusicBed,
  SFX_FAMILIES,
  createTheme,
  getDuck,
  resolveCached,
  sfxGainAt,
  voiceLevelAt,
  gainToDb,
  type Canvas,
  type SfxFamily,
  type Theme,
} from '..';
import {AUDIO_DEMO_SECONDS, FAKE_VO, FAKE_VO_SEGMENTS, audioDemoCues} from './AudioDemoCues';

const CUES = audioDemoCues();
const hue = (f: SfxFamily) => (SFX_FAMILIES.indexOf(f) * 360) / SFX_FAMILIES.length;
const DUCK_DB = 7.5;

/** Props for the audio demo. */
export interface AudioDemoProps {
  /** Theme (colours, fonts, canvas fps/size). Default: midnight at 1920x1080 / 60. */
  theme?: Theme;
  /** Frame number. Passed in by the composition wrapper; the demo itself is a pure function of it. */
  frame: number;
  /** Mute audio (stills). */
  silent?: boolean;
}

/**
 * Visual + audio demo: a 10 s timeline with every cue family, a fake voice-over envelope, the music duck curve, and a
 * playhead. Pure function of `frame`.
 * @example <AudioDemo frame={frame} theme={createTheme({canvas: CANVAS.vertical60})} />
 */
export const AudioDemo: React.FC<AudioDemoProps> = ({theme = createTheme(), frame, silent}) => {
  const {width: w, height: h, fps} = theme.canvas;
  const m = Math.min(w, h);
  const t = frame / fps;
  const {cues, dropped} = resolveCached(CUES, 1);
  const duck = getDuck(FAKE_VO, {depthDb: DUCK_DB});
  const sfxMix = {voice: FAKE_VO};

  const px = w * 0.06;
  const pw = w - 2 * px;
  const top = h * (w > h ? 0.2 : 0.14);
  const lanes = SFX_FAMILIES.length + 2; // + voice + duck
  const bottom = h * (w > h ? 0.9 : 0.86);
  const laneH = (bottom - top) / lanes;
  const X = (s: number) => px + (s / AUDIO_DEMO_SECONDS) * pw;
  const labelW = m * 0.2;
  const trackX = (s: number) => px + labelW + (s / AUDIO_DEMO_SECONDS) * (pw - labelW);
  const fs = Math.max(11, Math.min(laneH * 0.55, m * 0.022));

  const playing = cues.filter((c) => t >= c.at && t < c.end);
  const duckDbNow = duck.gainDbAtSeconds(t);
  const speaking = voiceLevelAt(FAKE_VO, t, 1 / 30) > 0.003;

  // VO bars (dB scale -60..-14) and duck line, drawn once per frame from pure data
  const voLane = SFX_FAMILIES.length;
  const duckLane = SFX_FAMILIES.length + 1;
  const bars: React.ReactNode[] = [];
  const barW = (pw - labelW) / FAKE_VO.rms.length;
  FAKE_VO.rms.forEach((r, i) => {
    const db = gainToDb(r);
    const k = Math.max(0, Math.min(1, (db + 60) / 46));
    const y0 = top + (voLane + 1) * laneH - 3;
    bars.push(<rect key={i} x={trackX(i / FAKE_VO.hz)} y={y0 - k * (laneH - 6)} width={Math.max(1, barW - 0.5)} height={k * (laneH - 6)} fill={theme.colors.text.secondary} opacity={0.75} />);
  });
  let duckPath = '';
  for (let i = 0; i <= 400; i++) {
    const s = (i / 400) * AUDIO_DEMO_SECONDS;
    const k = -duck.gainDbAtSeconds(s) / 9;
    duckPath += `${i ? 'L' : 'M'}${trackX(s).toFixed(1)},${(top + duckLane * laneH + 4 + k * (laneH - 10)).toFixed(1)}`;
  }

  return (
    <AbsoluteFill style={{background: `linear-gradient(160deg, ${theme.colors.background.base}, ${theme.colors.background.deep})`, color: theme.colors.text.primary, fontFamily: theme.fonts.body}}>
      {!silent && (
        <>
          <Audio src={staticFile('kit/demo/fake-vo.wav')} />
          <MusicBed src="kit/music/pad-loop.wav" fps={fps} voice={FAKE_VO} duck={{depthDb: DUCK_DB}} totalSeconds={AUDIO_DEMO_SECONDS} fadeInSeconds={0.5} fadeOutSeconds={1} />
          <CueTrack cues={CUES} fps={fps} seed={1} mix={sfxMix} />
        </>
      )}
      <div style={{position: 'absolute', left: px, top: h * 0.05, fontSize: m * 0.05, fontWeight: 700, letterSpacing: -1}}>Kit audio — cue timeline</div>
      <div style={{position: 'absolute', left: px, top: h * 0.05 + m * 0.065, fontSize: m * 0.022, color: theme.colors.text.secondary}}>
        {w}×{h} @ {fps} fps · {cues.length} cues kept, {dropped.length} dropped by limits · music duck {DUCK_DB} dB, 80 ms / 400 ms
      </div>
      <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
        {/* speech shading */}
        {FAKE_VO_SEGMENTS.map(([a, b], i) => (
          <rect key={i} x={trackX(a)} y={top} width={trackX(b) - trackX(a)} height={lanes * laneH} fill={theme.colors.accent} opacity={0.07} />
        ))}
        {Array.from({length: lanes}).map((_, i) => (
          <line key={i} x1={px} x2={px + pw} y1={top + (i + 1) * laneH} y2={top + (i + 1) * laneH} stroke={theme.colors.text.tertiary} strokeOpacity={0.25} />
        ))}
        {SFX_FAMILIES.map((f, i) => (
          <text key={f} x={px} y={top + i * laneH + laneH * 0.68} fontSize={fs} fill={theme.colors.text.secondary}>{f}</text>
        ))}
        <text x={px} y={top + voLane * laneH + laneH * 0.68} fontSize={fs} fill={theme.colors.accent}>voice-over (fake)</text>
        <text x={px} y={top + duckLane * laneH + laneH * 0.68} fontSize={fs} fill={theme.colors.accent}>music duck 0…−9 dB</text>
        {[...Array(AUDIO_DEMO_SECONDS + 1).keys()].map((s) => (
          <text key={s} x={trackX(s)} y={top - 8} fontSize={fs * 0.9} textAnchor="middle" fill={theme.colors.text.tertiary}>{s}s</text>
        ))}
        {cues.map((c) => {
          const lane = SFX_FAMILIES.indexOf(c.name);
          const live = t >= c.at && t < c.end;
          const flash = Math.max(0, 1 - (t - c.at) / 0.25) * (t >= c.at ? 1 : 0);
          return (
            <rect key={c.id} x={trackX(c.at)} y={top + lane * laneH + 3} width={Math.max(5, trackX(c.end) - trackX(c.at))} height={laneH - 6} rx={3}
              fill={`hsl(${hue(c.name)} 80% 62%)`} opacity={live ? 1 : 0.55 + 0.45 * flash} stroke={live ? '#fff' : 'none'} strokeWidth={1.5} />
          );
        })}
        {dropped.map((d) => (
          <g key={`d${d.id}`}>
            <rect x={trackX(d.cue.at)} y={top + SFX_FAMILIES.indexOf(d.cue.name) * laneH + 3} width={Math.max(5, trackX(d.cue.at + 0.15) - trackX(d.cue.at))} height={laneH - 6} rx={3} fill="none" stroke={theme.colors.semantic.negative} strokeDasharray="4 3" strokeWidth={1.5} />
          </g>
        ))}
        {bars}
        <path d={duckPath} fill="none" stroke={theme.colors.accent} strokeWidth={2.5} />
        <line x1={trackX(t)} x2={trackX(t)} y1={top - 4} y2={top + lanes * laneH} stroke="#fff" strokeWidth={2} />
      </svg>
      <div style={{position: 'absolute', left: px, top: bottom + h * 0.015, width: pw, display: 'flex', gap: m * 0.03, fontSize: m * 0.024, flexWrap: 'wrap'}}>
        <span style={{fontVariantNumeric: 'tabular-nums'}}>t = {t.toFixed(2)} s</span>
        <span style={{fontVariantNumeric: 'tabular-nums'}}>music {duckDbNow.toFixed(1)} dB</span>
        <span style={{color: speaking ? theme.colors.accent : theme.colors.text.tertiary}}>{speaking ? 'voice: speaking' : 'voice: silent'}</span>
        <span style={{color: theme.colors.text.secondary}}>
          playing: {playing.length ? playing.map((c) => `${c.name} (${gainToDb(sfxGainAt(c, t, sfxMix)).toFixed(0)} dB)`).join(', ') : '—'}
        </span>
      </div>
      <div style={{position: 'absolute', left: px, bottom: h * 0.02, fontSize: m * 0.018, color: theme.colors.text.tertiary}}>
        solid = played · dashed red = dropped by limits (max 3 at once, no identical file within 120 ms)
      </div>
    </AbsoluteFill>
  );
};

/** Wrapper that feeds `useCurrentFrame()` into the pure {@link AudioDemo}. */
export const AudioDemoComposition: React.FC<{canvas: Canvas}> = ({canvas}) => {
  const frame = useCurrentFrame();
  return <AudioDemo frame={frame} theme={createTheme({canvas})} />;
};

/**
 * Registers the audio demo compositions (16:9 @ 60, 9:16 @ 60, 16:9 @ 30).
 * @example <KitAudioCompositions />
 */
export const KitAudioCompositions: React.FC = () => (
  <>
    {(
      [
        ['Kit-Audio-Demo', CANVAS.landscape60],
        ['Kit-Audio-Demo-Vertical', CANVAS.vertical60],
        ['Kit-Audio-Demo-30fps', CANVAS.landscape30],
      ] as const
    ).map(([id, c]) => (
      <Composition key={id} id={id} component={AudioDemoComposition} defaultProps={{canvas: c as Canvas}} durationInFrames={Math.round(AUDIO_DEMO_SECONDS * c.fps)} width={c.width} height={c.height} fps={c.fps} />
    ))}
  </>
);
