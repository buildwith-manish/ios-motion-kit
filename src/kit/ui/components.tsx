import React from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {Glass} from '../glass';
import {IconTile} from '../icons';
import type {IconName} from '../icons';
import {rgba} from '../tokens/color';
import {radius, safeRect, space, textStyle, unit} from '../tokens';
import type {Theme} from '../tokens';
import {springProgress, uiMotionStyle, useUIMotion, type UIMotionProps} from './motion';

export interface PillProps extends UIMotionProps {
  label: ReactNode;
  expandedContent?: ReactNode;
  compactWidth?: number;
  expandedWidth?: number;
  expandAt?: number;
  expanded?: boolean;
}

export const Pill: React.FC<PillProps> = ({label, expandedContent, compactWidth = 156, expandedWidth = 400, expandAt, expanded = false, ...props}) => {
  const {theme, motion} = useUIMotion(props);
  const u = unit(theme);
  const expansion = expandAt === undefined ? (expanded ? 1 : 0) : springProgress(motion.time, expandAt, props.response ?? theme.motion.spring.SNAPPY);
  const width = (compactWidth + (expandedWidth - compactWidth) * expansion) * u;
  return (
    <Glass tier="pill" theme={theme} className={props.className} style={{...uiMotionStyle(motion), width, padding: `${space(theme, 3)}px ${space(theme, 5)}px`, borderRadius: radius(theme, 'pill'), boxSizing: 'border-box', ...props.style}}>
      <div style={{display: 'flex', alignItems: 'center', gap: space(theme, 3), whiteSpace: 'nowrap', overflow: 'hidden'}}>
        <span style={{...textStyle(theme, 'body', {weight: 'bold'}), flex: 'none'}}>{label}</span>
        {expandedContent !== undefined && <span style={{...textStyle(theme, 'caption', {color: 'secondary'}), opacity: expansion, overflow: 'hidden', textOverflow: 'ellipsis'}}>{expandedContent}</span>}
      </div>
    </Glass>
  );
};

export interface ChipProps extends UIMotionProps {
  label: ReactNode;
  icon?: IconName;
}

export const Chip: React.FC<ChipProps> = ({label, icon, ...props}) => {
  const {theme, motion} = useUIMotion(props);
  const u = unit(theme);
  return (
    <Glass tier="chip" theme={theme} className={props.className} style={{...uiMotionStyle(motion), display: 'inline-flex', alignItems: 'center', gap: space(theme, 2), padding: `${space(theme, 2)}px ${space(theme, 4)}px`, borderRadius: radius(theme, 'pill'), ...props.style}}>
      {icon && <IconTile name={icon} size={20 * u} iconSize={14 * u} fill="tinted" theme={theme} />}
      <span style={textStyle(theme, 'caption', {weight: 'bold'})}>{label}</span>
    </Glass>
  );
};

export type BadgeTone = 'accent' | 'positive' | 'warning' | 'negative';

export interface BadgeProps extends UIMotionProps {
  label: ReactNode;
  tone?: BadgeTone;
}

export const Badge: React.FC<BadgeProps> = ({label, tone = 'accent', ...props}) => {
  const {theme, motion} = useUIMotion(props);
  const color = tone === 'accent' ? theme.colors.accent : theme.colors.semantic[tone];
  return (
    <Glass tier="chip" theme={theme} className={props.className} style={{...uiMotionStyle(motion), display: 'inline-flex', alignItems: 'center', padding: `${space(theme, 1)}px ${space(theme, 3)}px`, borderRadius: radius(theme, 'pill'), background: `linear-gradient(135deg, ${rgba(color, 0.22)}, ${rgba(color, 0.08)})`, boxShadow: `inset 0 0 0 1px ${rgba(color, 0.5)}`, ...props.style}}>
      <span style={textStyle(theme, 'caption', {weight: 'bold'})}>{label}</span>
    </Glass>
  );
};

export interface ButtonProps extends UIMotionProps {
  label: ReactNode;
  icon?: IconName;
  variant?: 'primary' | 'secondary';
  pressAt?: number;
  pressDuration?: number;
}

export const Button: React.FC<ButtonProps> = ({label, icon, variant = 'primary', pressAt, pressDuration = 0.18, ...props}) => {
  const {theme, motion} = useUIMotion(props);
  const u = unit(theme);
  const pressResponse = props.response ?? theme.motion.spring.SNAPPY;
  if (!Number.isFinite(pressDuration) || pressDuration <= 0) throw new RangeError('Button pressDuration must be finite and positive');
  const pressed = pressAt === undefined ? 0 : springProgress(motion.time, pressAt, pressResponse) * (1 - springProgress(motion.time, pressAt + pressDuration, pressResponse));
  const primary = variant === 'primary';
  return (
    <div role="button" aria-disabled="true" className={props.className} style={{display: 'inline-flex'}}>
      <Glass
        tier="pill"
        theme={theme}
        style={{...uiMotionStyle(motion), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: space(theme, 3), padding: `${space(theme, 3)}px ${space(theme, 6)}px`, borderRadius: radius(theme, 'pill'), transform: `translate3d(0, ${motion.y}px, 0) scale(${motion.scale * (1 - pressed * 0.04)})`, background: primary ? theme.colors.accent : undefined, color: primary ? theme.colors.onAccent : theme.colors.text.primary, boxShadow: primary ? `0 8px 24px ${rgba(theme.colors.accent, 0.24)}` : undefined, ...props.style}}
      >
        {icon && <IconTile name={icon} size={22 * u} iconSize={15 * u} tone={primary ? 'onAccent' : 'accent'} fill={primary ? 'glass' : 'tinted'} theme={theme} />}
        <span style={{...textStyle(theme, 'body', {weight: 'bold', color: primary ? 'onAccent' : 'primary'}), position: 'relative', zIndex: 1}}>{label}</span>
        {pressed > 0.01 && <span aria-hidden style={{position: 'absolute', inset: 0, pointerEvents: 'none', background: `linear-gradient(180deg, ${rgba(theme.colors.onAccent, 0.2 * pressed)}, transparent 70%)`}} />}
      </Glass>
    </div>
  );
};

export interface ToggleProps extends UIMotionProps {
  checked: boolean;
  changedAt?: number;
  label?: ReactNode;
}

export const Toggle: React.FC<ToggleProps> = ({checked, changedAt, label, ...props}) => {
  const {theme, motion} = useUIMotion(props);
  const u = unit(theme);
  const from = checked ? 0 : 1;
  const progress = changedAt === undefined ? (checked ? 1 : 0) : from + (checked ? 1 : -1) * springProgress(motion.time, changedAt, props.response ?? theme.motion.spring.SNAPPY);
  const trackWidth = 60 * u;
  const trackHeight = 34 * u;
  const thumb = 26 * u;
  const offset = (trackWidth - trackHeight) * progress;
  return (
    <div className={props.className} style={{...uiMotionStyle(motion), display: 'inline-flex', alignItems: 'center', gap: space(theme, 3), ...props.style}}>
      <span role="switch" aria-checked={progress >= 0.5} style={{position: 'relative', width: trackWidth, height: trackHeight, flex: 'none', borderRadius: radius(theme, 'pill'), background: progress > 0.01 ? rgba(theme.colors.accent, 0.88 * progress + 0.12) : rgba(theme.colors.text.primary, 0.18), boxShadow: `inset 0 0 0 1px ${rgba(theme.colors.text.primary, 0.12)}`}}>
        <span style={{position: 'absolute', left: 4 * u + offset, top: (trackHeight - thumb) / 2, width: thumb, height: thumb, borderRadius: radius(theme, 'pill'), background: progress > 0.5 ? theme.colors.onAccent : theme.colors.text.primary, boxShadow: `0 2px 6px ${rgba(theme.colors.background.deep, 0.34)}`}} />
      </span>
      {label && <span style={textStyle(theme, 'body')}>{label}</span>}
    </div>
  );
};

export interface SegmentOption {
  id: string;
  label: ReactNode;
}

export interface SegmentedProps extends UIMotionProps {
  segments: readonly SegmentOption[];
  selected: string;
  fromSelected?: string;
  selectionAt?: number;
}

export const Segmented: React.FC<SegmentedProps> = ({segments, selected, fromSelected, selectionAt, ...props}) => {
  const {theme, motion} = useUIMotion(props);
  if (!segments.length) throw new RangeError('Segmented requires at least one segment');
  const targetIndex = segments.findIndex((segment) => segment.id === selected);
  const fromIndex = segments.findIndex((segment) => segment.id === (fromSelected ?? selected));
  if (targetIndex < 0 || fromIndex < 0) throw new RangeError('Segmented selection must match a segment id');
  const progress = selectionAt === undefined ? 1 : springProgress(motion.time, selectionAt, props.response ?? theme.motion.spring.SNAPPY);
  const selectedPosition = fromIndex + (targetIndex - fromIndex) * progress;
  return (
    <Glass tier="chip" theme={theme} className={props.className} style={{...uiMotionStyle(motion), position: 'relative', display: 'flex', alignItems: 'center', padding: 4 * unit(theme), borderRadius: radius(theme, 'pill'), ...props.style}}>
      <span aria-hidden style={{position: 'absolute', left: 4 * unit(theme), top: 4 * unit(theme), bottom: 4 * unit(theme), width: `calc((100% - ${8 * unit(theme)}px) / ${segments.length})`, borderRadius: radius(theme, 'pill'), transform: `translateX(${selectedPosition * 100}%)`, background: rgba(theme.colors.accent, 0.22), boxShadow: `inset 0 0 0 1px ${rgba(theme.colors.accent, 0.34)}`}} />
      {segments.map((segment) => (
        <span key={segment.id} style={{position: 'relative', zIndex: 1, flex: 1, padding: `${space(theme, 2)}px ${space(theme, 4)}px`, textAlign: 'center', whiteSpace: 'nowrap', ...textStyle(theme, 'caption', {weight: 'bold'})}}>
          {segment.label}
        </span>
      ))}
    </Glass>
  );
};

export interface ListRowData {
  id: string;
  label: string;
  value?: ReactNode;
  icon?: IconName;
}

export interface ListRowProps extends UIMotionProps {
  row: ListRowData;
  divider?: boolean;
}

export const ListRow: React.FC<ListRowProps> = ({row, divider = false, ...props}) => {
  const {theme, motion} = useUIMotion(props);
  const u = unit(theme);
  return (
    <div className={props.className} style={{...uiMotionStyle(motion), position: 'relative', display: 'flex', alignItems: 'center', gap: space(theme, 3), minHeight: 64 * u, padding: `${space(theme, 2)}px ${space(theme, 4)}px`, ...props.style}}>
      {row.icon && <IconTile name={row.icon} size={40 * u} iconSize={21 * u} fill="tinted" theme={theme} />}
      <span style={{...textStyle(theme, 'body'), flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{row.label}</span>
      {row.value !== undefined && <span style={{...textStyle(theme, 'body', {color: 'secondary', weight: 'bold'}), whiteSpace: 'nowrap'}}>{row.value}</span>}
      {divider && <span aria-hidden style={{position: 'absolute', left: 16 * u, right: 16 * u, bottom: 0, height: Math.max(1, u), background: rgba(theme.colors.text.primary, 0.12)}} />}
    </div>
  );
};

export interface ListGroupProps extends UIMotionProps {
  rows: readonly ListRowData[];
  rowStagger?: number;
}

export const ListGroup: React.FC<ListGroupProps> = ({rows, rowStagger, ...props}) => {
  const {theme, motion} = useUIMotion(props);
  const stagger = rowStagger ?? theme.motion.stagger.tight;
  return (
    <Glass tier="card" theme={theme} className={props.className} style={{...uiMotionStyle(motion), borderRadius: radius(theme, 'lg'), padding: `${space(theme, 2)}px 0`, ...props.style}}>
      {rows.map((row, index) => (
        <ListRow key={row.id} row={row} frame={props.frame} start={props.start + index * stagger} end={props.end} response={props.response} theme={theme} divider={index < rows.length - 1} />
      ))}
    </Glass>
  );
};

export interface AlertCardProps extends UIMotionProps {
  icon: IconName;
  title: ReactNode;
  body: ReactNode;
  tone?: 'positive' | 'warning' | 'negative';
}

export const AlertCard: React.FC<AlertCardProps> = ({icon, title, body, tone = 'warning', ...props}) => {
  const {theme, motion} = useUIMotion(props);
  const u = unit(theme);
  const color = theme.colors.semantic[tone];
  return (
    <Glass tier="card" theme={theme} className={props.className} style={{...uiMotionStyle(motion), display: 'flex', alignItems: 'flex-start', gap: space(theme, 4), padding: space(theme, 5), borderRadius: radius(theme, 'lg'), ...props.style}}>
      <IconTile name={icon} size={46 * u} iconSize={24 * u} tone={tone} fill="tinted" theme={theme} />
      <div style={{minWidth: 0}}>
        <div style={{...textStyle(theme, 'body', {weight: 'bold'}), marginBottom: space(theme, 1)}}>{title}</div>
        <div style={{...textStyle(theme, 'caption', {color: 'secondary'}), lineHeight: 1.4}}>{body}</div>
      </div>
      <span aria-hidden style={{position: 'absolute', left: 0, top: space(theme, 4), bottom: space(theme, 4), width: 3 * u, borderRadius: radius(theme, 'pill'), background: color}} />
    </Glass>
  );
};

export interface WidgetProps extends UIMotionProps {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  sparkline?: ReactNode;
}

export const Widget: React.FC<WidgetProps> = ({label, value, delta, sparkline, ...props}) => {
  const {theme, motion} = useUIMotion(props);
  return (
    <Glass tier="card" theme={theme} className={props.className} style={{...uiMotionStyle(motion), display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: space(theme, 3), minHeight: 132 * unit(theme), padding: space(theme, 5), borderRadius: radius(theme, 'lg'), ...props.style}}>
      <div style={textStyle(theme, 'caption', {color: 'secondary', weight: 'bold'})}>{label}</div>
      <div style={{display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: space(theme, 3)}}>
        <div style={{...textStyle(theme, 'number'), fontSize: theme.type.number.size * unit(theme) * 0.82}}>{value}</div>
        {sparkline}
      </div>
      {delta && <div style={{...textStyle(theme, 'caption', {color: 'accent', weight: 'bold'})}}>{delta}</div>}
    </Glass>
  );
};

export interface SheetProps extends UIMotionProps {
  title: ReactNode;
  children?: ReactNode;
  height?: number;
}

export const Sheet: React.FC<SheetProps> = ({title, children, height = 460, ...props}) => {
  const {theme, motion} = useUIMotion(props);
  const safe = safeRect(theme, 'action');
  const u = unit(theme);
  const sheetHeight = Math.min(height * u, theme.canvas.height * 0.58);
  const travel = (1 - motion.enter + motion.exit) * sheetHeight;
  return (
    <div aria-hidden style={{position: 'absolute', inset: 0, zIndex: 40, opacity: motion.opacity, pointerEvents: 'none', ...props.style}}>
      <div style={{position: 'absolute', inset: 0, background: rgba(theme.colors.background.deep, 0.62 * motion.opacity)}} />
      <Glass tier="sheet" theme={theme} className={props.className} style={{position: 'absolute', left: safe.left, bottom: 0, width: safe.width, height: sheetHeight, boxSizing: 'border-box', padding: space(theme, 8), borderBottomLeftRadius: 0, borderBottomRightRadius: 0, transform: `translate3d(0, ${travel}px, 0)`, opacity: motion.enter * (1 - motion.exit)}}>
        <div style={{...textStyle(theme, 'title'), marginBottom: space(theme, 4)}}>{title}</div>
        {children}
      </Glass>
    </div>
  );
};

export interface TooltipProps extends UIMotionProps {
  label: ReactNode;
  placement?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({label, placement = 'top', ...props}) => {
  const {theme, motion} = useUIMotion(props);
  const u = unit(theme);
  return (
    <span role="tooltip" className={props.className} style={{display: 'inline-flex'}}>
      <Glass tier="chip" theme={theme} style={{...uiMotionStyle(motion), position: 'relative', display: 'inline-flex', padding: `${space(theme, 2)}px ${space(theme, 4)}px`, borderRadius: radius(theme, 'md'), ...props.style}}>
        <span style={textStyle(theme, 'caption', {weight: 'bold'})}>{label}</span>
        <span aria-hidden style={{position: 'absolute', left: '50%', ...(placement === 'top' ? {bottom: -4 * u} : {top: -4 * u}), width: 8 * u, height: 8 * u, transform: 'translateX(-50%) rotate(45deg)', background: theme.glass.chip.fillTo, borderRight: `1px solid ${theme.glass.chip.rimMid}`, borderBottom: `1px solid ${theme.glass.chip.rimMid}`}} />
      </Glass>
    </span>
  );
};
