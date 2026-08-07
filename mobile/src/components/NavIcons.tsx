import React from 'react';
import Svg, { Path, Polyline, Line, Rect, Circle } from 'react-native-svg';

type IconProps = {
  size?: number;
  color?: string;
};

/** Minimal line icons for CollectUI-style action nav (no vector-icons dep). */
export function IconShare({ size = 20, color = '#F5F5F5' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Polyline
        points="16 6 12 2 8 6"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={12}
        y1={2}
        x2={12}
        y2={15}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconFolder({ size = 20, color = '#F5F5F5' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconTrash({ size = 20, color = '#F5F5F5' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="3 6 5 6 21 6"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={10}
        y1={11}
        x2={10}
        y2={17}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <Line
        x1={14}
        y1={11}
        x2={14}
        y2={17}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Filled binder mark for flyout rows */
export function IconBinder({ size = 18, color = '#F5F5F5' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={4}
        y={3}
        width={16}
        height={18}
        rx={2}
        stroke={color}
        strokeWidth={1.75}
      />
      <Line
        x1={8}
        y1={3}
        x2={8}
        y2={21}
        stroke={color}
        strokeWidth={1.75}
      />
      <Circle cx={8} cy={8} r={0.9} fill={color} />
      <Circle cx={8} cy={12} r={0.9} fill={color} />
    </Svg>
  );
}
