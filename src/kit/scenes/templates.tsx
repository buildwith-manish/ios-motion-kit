import React from 'react';
import type {ReactNode} from 'react';
import {Glass} from '../glass';
import {ShortfallBars, Ticker, type ShortfallBarsData, type TickerStep} from '../dataviz';
import {iosSpring} from '../motion';
import {NumberText} from '../text';
import {radius, safeRect, space, textStyle, unit} from '../tokens';
import type {Theme} from '../tokens';
import {rgba} from '../tokens/color';

export interface SceneTemplateProps {
  frame: number;
  start: number;
  theme: Theme;
}

interface SceneLayoutProps extends SceneTemplateProps {
  children: ReactNode;
  align?: 'center' | 'start';
  style?: React.CSSProperties;
}

const SceneLayout: React.FC<SceneLayoutProps> = ({frame: _frame, start: _start, theme, children, align = 'center', style}) => {
  const safe = safeRect(theme, 'title');
  return (
    <div style={{position: 'absolute', left: safe.left, top: safe.top, width: safe.width, height: safe.height, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: align === 'center' ? 'center' : 'stretch', gap: space(theme, 6), color: theme.colors.text.primary, ...style}}>
      {children}
    </div>
  );
};

export const fitSceneTitle = (text: string, width: number, maxSize: number, minSize = 32): number => {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(maxSize) || maxSize <= 0 || !Number.isFinite(minSize) || minSize <= 0) {
    throw new RangeError('Title fitting requires positive finite dimensions');
  }
  const estimatedWidth = Math.max(1, [...text].length) * maxSize * 0.56;
  return Math.max(minSize, Math.min(maxSize, maxSize * Math.sqrt(width / estimatedWidth)));
};

export interface SectionTitleProps extends SceneTemplateProps {
  title: string;
  eyebrow?: string;
  body?: string;
  align?: 'center' | 'start';
}

interface SectionTitleContentProps {
  theme: Theme;
  title: string;
  eyebrow?: string;
  body?: string;
  align?: 'center' | 'start';
}

const SectionTitleContent: React.FC<SectionTitleContentProps> = ({theme, title, eyebrow, body, align = 'center'}) => {
  const safe = safeRect(theme, 'title');
  const u = unit(theme);
  const fontSize = fitSceneTitle(title, safe.width, theme.type.title.size * u * 1.15, 34 * u);
  return (
    <>
      {eyebrow && <div style={{...textStyle(theme, 'caption', {color: 'accent', weight: 'bold'}), letterSpacing: '0.12em', textTransform: 'uppercase'}}>{eyebrow}</div>}
      <div style={{...textStyle(theme, 'title', {weight: 'bold'}), fontSize, maxWidth: '100%', textAlign: align, lineHeight: 1.06}}>{title}</div>
      {body && <div style={{...textStyle(theme, 'body', {color: 'secondary'}), maxWidth: 1050 * u, textAlign: align, lineHeight: 1.45}}>{body}</div>}
    </>
  );
};

export const SectionTitle: React.FC<SectionTitleProps> = ({frame, start, theme, ...props}) => (
  <SceneLayout frame={frame} start={start} theme={theme} align={props.align}>
    <SectionTitleContent theme={theme} {...props} />
  </SceneLayout>
);

export interface HookProps extends SectionTitleProps {}

export const Hook: React.FC<HookProps> = (props) => <SectionTitle {...props} />;

export interface StatCardProps extends SceneTemplateProps {
  label: string;
  value: number;
  from?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  delta?: string;
}

export const StatCard: React.FC<StatCardProps> = ({frame, start, theme, label, value, from, prefix, suffix, decimals, delta}) => {
  const u = unit(theme);
  return (
    <SceneLayout frame={frame} start={start} theme={theme}>
      <Glass tier="card" theme={theme} style={{width: 'min(100%, 1120px)', boxSizing: 'border-box', padding: space(theme, 8), borderRadius: radius(theme, 'xxl'), textAlign: 'center'}}>
        <div style={{...textStyle(theme, 'body', {color: 'secondary', weight: 'bold'}), marginBottom: space(theme, 4)}}>{label}</div>
        <NumberText frame={frame} start={start + 0.25} duration={0.9} theme={theme} to={value} from={from} prefix={prefix} suffix={suffix} decimals={decimals} fontSize={104 * u} />
        {delta && <div style={{...textStyle(theme, 'caption', {color: 'accent', weight: 'bold'}), marginTop: space(theme, 4)}}>{delta}</div>}
      </Glass>
    </SceneLayout>
  );
};

export interface RankingProps extends SceneTemplateProps {
  title: string;
  data: readonly TickerStep[];
  highlight?: string;
}

export const Ranking: React.FC<RankingProps> = ({frame, start, theme, title, data, highlight}) => {
  const safe = safeRect(theme, 'title');
  const u = unit(theme);
  const shifted = data.map((step) => ({...step, at: step.at + start + 0.45}));
  return (
    <SceneLayout frame={frame} start={start} theme={theme} align="start">
      <SectionTitleContent theme={theme} title={title} align="start" />
      <Ticker frame={frame} data={shifted} width={Math.min(820, safe.width / u)} rowHeight={72} highlight={highlight} theme={theme} style={{maxWidth: '100%'}} />
    </SceneLayout>
  );
};

export interface ComparisonValue {
  label: string;
  value: number;
}

export interface ComparisonProps extends SceneTemplateProps {
  title: string;
  left: ComparisonValue;
  right: ComparisonValue;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export const Comparison: React.FC<ComparisonProps> = ({frame, start, theme, title, left, right, prefix, suffix, decimals}) => {
  const u = unit(theme);
  const card = (item: ComparisonValue, direction: 'left' | 'right') => (
    <Glass tier="card" theme={theme} style={{flex: '1 1 0', minWidth: 0, padding: space(theme, 8), borderRadius: radius(theme, 'xl'), textAlign: 'center', boxShadow: direction === 'right' ? `inset 0 0 0 1px ${rgba(theme.colors.accent, 0.38)}` : undefined}}>
      <div style={{...textStyle(theme, 'caption', {color: 'secondary', weight: 'bold'}), marginBottom: space(theme, 4)}}>{item.label}</div>
      <NumberText frame={frame} start={start + 0.45} duration={0.9} theme={theme} to={item.value} prefix={prefix} suffix={suffix} decimals={decimals} fontSize={66 * u} />
    </Glass>
  );
  return (
    <SceneLayout frame={frame} start={start} theme={theme}>
      <SectionTitleContent theme={theme} title={title} />
      <div style={{display: 'flex', width: '100%', gap: space(theme, 5), alignItems: 'center'}}>
        {card(left, 'left')}
        <div style={{...textStyle(theme, 'title', {color: 'accent', weight: 'bold'}), flex: 'none'}}>vs</div>
        {card(right, 'right')}
      </div>
    </SceneLayout>
  );
};

export interface NeededVsEarnedProps extends SceneTemplateProps {
  title: string;
  data: ShortfallBarsData;
}

export const NeededVsEarned: React.FC<NeededVsEarnedProps> = ({frame, start, theme, title, data}) => {
  const safe = safeRect(theme, 'title');
  const u = unit(theme);
  return (
    <SceneLayout frame={frame} start={start} theme={theme}>
      <SectionTitleContent theme={theme} title={title} />
      <ShortfallBars frame={frame} start={start + 0.4} data={data} length={Math.min(820, safe.width / u)} theme={theme} style={{maxWidth: '100%'}} />
    </SceneLayout>
  );
};

export interface TakeawayProps extends SectionTitleProps {}

export const Takeaway: React.FC<TakeawayProps> = (props) => {
  const {theme} = props;
  const {title, eyebrow, body, align} = props;
  return (
    <SceneLayout frame={props.frame} start={props.start} theme={theme}>
      <div style={{width: 12 * unit(theme), height: 12 * unit(theme), borderRadius: '50%', background: theme.colors.accent, boxShadow: `0 0 48px ${rgba(theme.colors.accent, 0.45)}`}} />
      <SectionTitleContent theme={theme} title={title} eyebrow={eyebrow} body={body} align={align} />
    </SceneLayout>
  );
};

export interface EndCardProps extends SceneTemplateProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
}

export const EndCard: React.FC<EndCardProps> = ({frame, start, theme, title, subtitle, actionLabel}) => {
  const u = unit(theme);
  return (
    <SceneLayout frame={frame} start={start} theme={theme}>
      <Glass tier="card" theme={theme} style={{width: 'min(100%, 1180px)', boxSizing: 'border-box', padding: space(theme, 8), borderRadius: radius(theme, 'xxl'), textAlign: 'center'}}>
        <div style={{...textStyle(theme, 'title', {weight: 'bold'}), fontSize: fitSceneTitle(title, safeRect(theme, 'title').width, theme.type.title.size * u * 1.15), lineHeight: 1.08}}>{title}</div>
        {subtitle && <div style={{...textStyle(theme, 'body', {color: 'secondary'}), marginTop: space(theme, 4)}}>{subtitle}</div>}
        {actionLabel && <div style={{display: 'inline-flex', marginTop: space(theme, 6), padding: `${space(theme, 3)}px ${space(theme, 6)}px`, borderRadius: radius(theme, 'pill'), background: theme.colors.accent, ...textStyle(theme, 'caption', {weight: 'bold'}), color: theme.colors.onAccent}}>{actionLabel}</div>}
      </Glass>
    </SceneLayout>
  );
};

export interface MapHeroProps extends SceneTemplateProps {
  title: string;
  subtitle?: string;
  origin?: string;
  destination?: string;
}

export const MapHero: React.FC<MapHeroProps> = ({frame, start, theme, title, subtitle, origin = 'North', destination = 'South'}) => {
  const safe = safeRect(theme, 'title');
  const u = unit(theme);
  const progress = Math.max(0, Math.min(1, iosSpring(frame / theme.canvas.fps - start - 0.45, theme.motion.spring.SMOOTH)));
  const mapWidth = Math.min(860 * u, safe.width);
  return (
    <SceneLayout frame={frame} start={start} theme={theme} align="start">
      <SectionTitleContent theme={theme} title={title} body={subtitle} align="start" />
      <Glass tier="card" theme={theme} style={{width: mapWidth, maxWidth: '100%', height: 430 * u, borderRadius: radius(theme, 'xxl'), overflow: 'hidden', position: 'relative'}}>
        <svg viewBox="0 0 860 430" width="100%" height="100%" aria-hidden>
          <path d="M92 112 149 77 218 91 261 54 314 82 369 68 408 104 466 91 506 117 563 103 604 134 676 129 735 170 716 216 759 253 723 292 660 281 622 321 558 303 516 341 451 321 403 353 350 321 301 340 251 298 197 306 160 266 106 250 123 206 81 173z" fill={rgba(theme.colors.tint.a, 0.14)} stroke={rgba(theme.colors.tint.a, 0.42)} strokeWidth="2" />
          <path d="M214 265 C278 188 351 242 408 198 S526 154 588 218 658 248 691 192" fill="none" stroke={rgba(theme.colors.accent, 0.23)} strokeWidth="12" strokeLinecap="round" />
          <path d="M214 265 C278 188 351 242 408 198 S526 154 588 218 658 248 691 192" pathLength={1} fill="none" stroke={theme.colors.accent} strokeWidth="4" strokeDasharray="1" strokeDashoffset={1 - progress} strokeLinecap="round" />
          <circle cx="214" cy="265" r="10" fill={theme.colors.accent} />
          <circle cx="691" cy="192" r="10" fill={theme.colors.semantic.positive} />
          <text x="184" y="304" fill={theme.colors.text.primary} fontSize="18">{origin}</text>
          <text x="652" y="171" fill={theme.colors.text.primary} fontSize="18">{destination}</text>
        </svg>
      </Glass>
    </SceneLayout>
  );
};
