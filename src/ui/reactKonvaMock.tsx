/**
 * Mock de react-konva para testes de componente (jsdom não tem canvas).
 * Mapeia os nós konva para elementos DOM simples, preservando os props e
 * eventos que os testes exercitam (onClick, name, x/y, draggable, onDragEnd).
 */
import type { ReactNode } from 'react';

interface NoProps {
  children?: ReactNode;
  name?: string;
  x?: number;
  y?: number;
  draggable?: boolean;
  onClick?: (e?: unknown) => void;
  onTap?: (e?: unknown) => void;
  onDragEnd?: (e: { target: { x: () => number; y: () => number } }) => void;
  [k: string]: unknown;
}

export function Stage({ children }: NoProps) {
  return <div data-testid="stage">{children}</div>;
}
export function Layer({ children }: NoProps) {
  return <div data-testid="layer">{children}</div>;
}
export function Group({ children, name, x, y, draggable, onClick, onDragEnd }: NoProps) {
  return (
    <div
      data-testid={name}
      data-x={x}
      data-y={y}
      data-draggable={String(!!draggable)}
      onClick={() => onClick?.()}
    >
      {onDragEnd && (
        <button
          data-testid={`drag-${name}`}
          onClick={() => onDragEnd({ target: { x: () => 400, y: () => 260 } })}
        />
      )}
      {children}
    </div>
  );
}
export const Rect = (_: NoProps) => null;
export const Circle = (_: NoProps) => null;
export const Text = (_: NoProps) => null;
export function Line(_: NoProps) {
  return <div data-testid="line" />;
}
export function Arrow({ onClick }: NoProps) {
  return <div data-testid="arrow" onClick={() => onClick?.()} />;
}
