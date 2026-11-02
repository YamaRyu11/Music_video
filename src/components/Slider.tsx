import { useRef, type PointerEvent } from 'react';

interface RangeProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
  defaultValue: number;
  onReset?: () => void;
  'aria-label': string;
  id?: string;
  className?: string;
}
interface Drag {
  pointer: number;
  lastX: number;
  width: number;
  raw: number;
  anchor: number;
  shift: boolean;
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
function snap(value: number, step: number, min: number, max: number, anchor = min) {
  if (value <= min) return min;
  if (value >= max) return max;
  return clamp(Number((anchor + Math.round((value - anchor) / step) * step).toFixed(12)), min, max);
}

/** Native range semantics with a relative, ten-times-finer Shift drag. */
export function RangeInput({ value, min, max, step, onValueChange, disabled, defaultValue, onReset, ...attributes }: RangeProps) {
  const drag = useRef<Drag | null>(null);
  const current = useRef(value); current.current = value;
  const fineStep = step / 10;
  const emit = (next: number) => {
    const previous = current.current;
    current.current = next;
    if (next !== previous) onValueChange(next);
  };
  const end = (event: PointerEvent<HTMLInputElement>) => {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  // Linked axes can hold values between grid points. Avoid native step rounding;
  // pointer, keyboard and accessibility changes are quantized explicitly below.
  return <input {...attributes} type="range" value={value} min={min} max={max} step="any" disabled={disabled}
    style={{ touchAction: 'none' }} title="ダブルクリックで初期値に戻す・Shift＋ドラッグで微調整"
    onDoubleClick={event => {
      if (event.currentTarget.matches(':disabled')) return;
      event.preventDefault();
      const pointer = drag.current?.pointer; drag.current = null;
      if (pointer !== undefined && event.currentTarget.hasPointerCapture(pointer)) event.currentTarget.releasePointerCapture(pointer);
      if (onReset) onReset(); else emit(clamp(defaultValue, min, max));
    }}
    onChange={event => { if (!drag.current && !event.currentTarget.matches(':disabled')) emit(snap(Number(event.target.value), fineStep, min, max)); }}
    onPointerDown={event => {
      if (event.button !== 0 || event.currentTarget.matches(':disabled') || max <= min) return;
      event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
      const rect = event.currentTarget.getBoundingClientRect();
      const next = event.shiftKey ? current.current : snap(min + clamp((event.clientX - rect.left) / rect.width, 0, 1) * (max - min), step, min, max);
      drag.current = { pointer: event.pointerId, lastX: event.clientX, width: Math.max(1, rect.width), raw: next,
        anchor: event.shiftKey ? next : min, shift: event.shiftKey };
      event.currentTarget.setPointerCapture(event.pointerId);
      emit(next);
    }}
    onPointerMove={event => {
      const state = drag.current;
      if (!state || state.pointer !== event.pointerId) return;
      if (event.currentTarget.matches(':disabled')) { end(event); return; }
      event.preventDefault();
      // Changing modifiers establishes a new relative anchor, never an absolute jump.
      if (state.shift !== event.shiftKey) {
        state.shift = event.shiftKey; state.raw = current.current; state.anchor = current.current;
      }
      state.raw = clamp(state.raw + (event.clientX - state.lastX) / state.width * (max - min) * (state.shift ? .1 : 1), min, max);
      state.lastX = event.clientX;
      emit(snap(state.raw, state.shift ? fineStep : step, min, max, state.anchor));
    }}
    onPointerUp={end} onPointerCancel={end}
    onLostPointerCapture={event => { if (drag.current?.pointer === event.pointerId) drag.current = null; }}
    onKeyDown={event => {
      if (event.currentTarget.matches(':disabled')) return;
      const amount = event.shiftKey ? fineStep : step;
      let next: number;
      switch (event.key) {
        case 'Home': next = min; break;
        case 'End': next = max; break;
        case 'ArrowRight': case 'ArrowUp': next = current.current + amount; break;
        case 'ArrowLeft': case 'ArrowDown': next = current.current - amount; break;
        case 'PageUp': next = current.current + amount * 10; break;
        case 'PageDown': next = current.current - amount * 10; break;
        default: return;
      }
      event.preventDefault(); emit(snap(next, fineStep, min, max));
    }} />;
}

export function Slider({ label, value, min, max, step = .05, suffix = '%', scale = 100, defaultValue, onReset, onChange }: {
  label: string; value: number; min: number; max: number; defaultValue: number; onReset?: () => void; step?: number; suffix?: string; scale?: number; onChange: (value: number) => void;
}) {
  const display = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2, useGrouping: false }).format(value * scale);
  return <label className="design-slider"><span>{label}<output>{display}{suffix}</output></span>
    <RangeInput aria-label={label} min={min} max={max} step={step} value={value} defaultValue={defaultValue} onReset={onReset} onValueChange={onChange} />
  </label>;
}
