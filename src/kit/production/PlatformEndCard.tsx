import React from 'react';
import {Glass} from '../glass';
import {radius, space, textStyle, unit} from '../tokens';
import type {Theme} from '../tokens';
import {rgba} from '../tokens/color';
import {fingerTravel, platformTiming, springAt, tapPress, type EndCardPlatform} from './logic';

export interface PlatformTapDemoProps {
  frame: number;
  /** Seconds. */
  start: number;
  theme: Theme;
  platform: EndCardPlatform;
  /** The video the tap opens (shown on the opened card). */
  videoTitle?: string;
  /** Channel / page / profile handle, e.g. "@yourchannel". */
  handle?: string;
  /** Facebook pinned-comment link, or Instagram bio link text. */
  linkText?: string;
  /** Instagram bio lines. */
  bioLines?: readonly string[];
  /** YouTube pill label. Default "Related video". */
  buttonLabel?: string;
  /** Facebook comment-bar placeholder. Default "Add a comment…". */
  commentLabel?: string;
}

const Touch: React.FC<{x: number; y: number; press: number; visible: number; u: number}> = ({x, y, press, visible, u}) => (
  <div style={{position: 'absolute', left: x, top: y, width: 64 * u, height: 64 * u, marginLeft: -32 * u, marginTop: -32 * u, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', border: `${4 * u}px solid rgba(255,255,255,0.92)`, boxShadow: `0 ${14 * u}px ${28 * u}px rgba(0,0,0,${0.4 + 0.2 * press})`, opacity: visible, transform: `scale(${1 - 0.28 * press})`, pointerEvents: 'none'}} />
);

const Rings: React.FC<{theme: Theme; t: number; at: number; x: number; y: number; w: number; h: number; r: number}> = ({theme, t, at, x, y, w, h, r}) => (
  <>
    {[0, 0.16].map((d) => {
      const p = Math.min(1, Math.max(0, (t - at - d) / 0.5));
      return p > 0 && p < 1 ? <div key={d} style={{position: 'absolute', left: x - p * 22, top: y - p * 22, width: w + p * 44, height: h + p * 44, borderRadius: r + p * 22, border: `3px solid ${rgba(theme.colors.accent, 0.5 * (1 - p))}`, pointerEvents: 'none'}} /> : null;
    })}
  </>
);

/** Platform-neutral tap demos for end cards: what to tap to reach the full video. Three variants, one pure component. No logos or brand colours. */
export const PlatformTapDemo: React.FC<PlatformTapDemoProps> = ({frame, start, theme, platform, videoTitle = 'Full video', handle = '@yourchannel', linkText = 'example.com/video', bioLines = [], buttonLabel = 'Related video', commentLabel = 'Add a comment…'}) => {
  const t = frame / theme.canvas.fps - start;
  const u = unit(theme);
  const tm = platformTiming(platform);
  const W = Math.min(theme.canvas.width * 0.86, 900 * u);
  const H = 440 * u;
  const barH = 76 * u;
  const barTop = H - barH - space(theme, 6);
  const uiIn = springAt(t, tm.ui, 0.5);
  const open = springAt(t, tm.open, 0.55);
  const [tap1, tap2] = tm.taps;
  const press1 = tapPress(t, tap1);
  const press2 = tap2 === undefined ? 0 : tapPress(t, tap2);
  const target = platform === 'facebook' ? tap2 : tap1;
  const fin = (tapAt: number, lead = 1.0) => fingerTravel(t, tapAt - lead, tapAt);
  const touchVis = (tapAt: number) => springAt(t, tapAt - 1.0, 0.3) * (1 - springAt(t, tapAt + 0.35, 0.3));
  const pad = space(theme, 6);
  const openCard = (top: number, left: number, w: number, h: number) => (
    <div style={{position: 'absolute', left, top, width: w, height: h, borderRadius: radius(theme, 'lg'), overflow: 'hidden', opacity: open, background: `linear-gradient(135deg, ${rgba(theme.colors.accent, 0.35)}, ${rgba(theme.colors.tint.a, 0.25)})`, display: 'flex', alignItems: 'flex-end', padding: space(theme, 4), boxSizing: 'border-box', transform: `scale(${0.92 + 0.08 * open})`}}>
      <div style={{...textStyle(theme, 'body', {weight: 'bold'}), lineHeight: 1.15}}>{videoTitle}</div>
    </div>
  );
  let body: React.ReactNode = null;

  if (platform === 'youtube') {
    const w = W - pad * 2;
    const h = barH + (H - pad * 2 - barH) * open;
    const top = barTop + (pad - barTop) * open;
    body = (
      <>
        <div style={{position: 'absolute', left: pad, top, width: w, height: h, borderRadius: (barH / 2) * (1 - open) + radius(theme, 'lg') * open, background: press1 > 0.05 && t < tm.open ? rgba(theme.colors.text.primary, 0.3) : rgba(theme.colors.text.primary, 0.16), opacity: uiIn, display: 'flex', alignItems: 'center', padding: `0 ${space(theme, 6)}px`, boxSizing: 'border-box', transform: `scale(${1 - 0.05 * press1})`, overflow: 'hidden'}}>
          <div style={{...textStyle(theme, 'body', {weight: 'bold'}), opacity: 1 - open}}>{buttonLabel}</div>
        </div>
        {openCard(pad, pad, w, H - pad * 2)}
        <Rings theme={theme} t={t} at={tap1} x={pad} y={barTop} w={w} h={barH} r={barH / 2} />
        <Touch x={W / 2 + (1 - fin(tap1)) * 220 * u} y={barTop + barH / 2 + (1 - fin(tap1)) * 180 * u} press={press1} visible={touchVis(tap1)} u={u} />
      </>
    );
  } else if (platform === 'facebook') {
    const sheet = springAt(t, tap1 + 0.1, 0.55);
    const linkTop = pad + 64 * u + space(theme, 8);
    const linkH = 56 * u;
    const bar = uiIn * (1 - sheet);
    body = (
      <>
        <div style={{position: 'absolute', left: pad, top: barTop, width: W - pad * 2, height: barH, borderRadius: barH / 2, background: press1 > 0.05 && t < tap1 + 0.2 ? rgba(theme.colors.text.primary, 0.3) : rgba(theme.colors.text.primary, 0.16), opacity: bar, display: 'flex', alignItems: 'center', padding: `0 ${space(theme, 6)}px`, boxSizing: 'border-box', transform: `scale(${1 - 0.05 * press1})`}}>
          <div style={{...textStyle(theme, 'body', {color: 'secondary'})}}>{commentLabel}</div>
        </div>
        <div style={{position: 'absolute', left: pad, top: pad, width: W - pad * 2, opacity: sheet * (1 - open), transform: `translateY(${(1 - sheet) * 40 * u}px)`}}>
          <div style={{...textStyle(theme, 'caption', {weight: 'bold', color: 'secondary'}), height: 64 * u}}>{handle} · Pinned</div>
          <div style={{...textStyle(theme, 'body'), marginBottom: space(theme, 2)}}>Full video:</div>
          <div style={{display: 'inline-block', ...textStyle(theme, 'body', {weight: 'bold'}), color: theme.colors.accentText, height: linkH, lineHeight: `${linkH}px`, textDecoration: press2 > 0.05 && t < tm.open ? 'underline' : 'none'}}>{linkText}</div>
        </div>
        {openCard(pad, pad, W - pad * 2, H - pad * 2)}
        <Rings theme={theme} t={t} at={tap1} x={pad} y={barTop} w={W - pad * 2} h={barH} r={barH / 2} />
        <Rings theme={theme} t={t} at={tap2} x={pad} y={linkTop} w={W * 0.5} h={linkH} r={linkH / 2} />
        <Touch x={W / 2 + (1 - fin(tap1)) * 220 * u} y={barTop + barH / 2 + (1 - fin(tap1)) * 180 * u} press={press1} visible={touchVis(tap1)} u={u} />
        <Touch x={pad + W * 0.25 + (1 - fin(tap2, 0.7)) * 200 * u} y={linkTop + linkH / 2 + (1 - fin(tap2, 0.7)) * 150 * u} press={press2} visible={touchVis(tap2)} u={u} />
      </>
    );
  } else {
    const lines = bioLines.slice(0, 4);
    const linkTop = pad + 120 * u + lines.length * 34 * u + space(theme, 2);
    const linkH = 48 * u;
    body = (
      <>
        <div style={{position: 'absolute', left: pad, top: pad, width: W - pad * 2, opacity: uiIn * (1 - open)}}>
          <div style={{display: 'flex', alignItems: 'center', gap: space(theme, 4), height: 100 * u}}>
            <div style={{width: 88 * u, height: 88 * u, borderRadius: '50%', background: theme.colors.accent, color: theme.colors.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...textStyle(theme, 'title', {weight: 'bold', color: theme.colors.onAccent}), fontSize: 40 * u}}>{handle.replace('@', '').charAt(0).toUpperCase()}</div>
            <div style={{...textStyle(theme, 'body', {weight: 'bold'})}}>{handle}</div>
          </div>
          {lines.map((l, i) => <div key={i} style={{...textStyle(theme, 'caption'), height: 34 * u, lineHeight: `${34 * u}px`}}>{l}</div>)}
          <div style={{display: 'inline-block', marginTop: space(theme, 2), height: linkH, lineHeight: `${linkH}px`, ...textStyle(theme, 'caption', {weight: 'bold'}), color: theme.colors.accentText, textDecoration: press1 > 0.05 && t < tm.open ? 'underline' : 'none'}}>{linkText}</div>
        </div>
        {openCard(pad, pad, W - pad * 2, H - pad * 2)}
        <Rings theme={theme} t={t} at={target} x={pad} y={linkTop} w={W * 0.5} h={linkH} r={linkH / 2} />
        <Touch x={pad + W * 0.25 + (1 - fin(tap1)) * 200 * u} y={linkTop + linkH / 2 + (1 - fin(tap1)) * 150 * u} press={press1} visible={touchVis(tap1)} u={u} />
      </>
    );
  }
  return (
    <Glass tier="card" theme={theme} style={{position: 'relative', width: W, height: H, boxSizing: 'border-box', borderRadius: radius(theme, 'xxl'), overflow: 'hidden', color: theme.colors.text.primary}}>
      {body}
    </Glass>
  );
};
