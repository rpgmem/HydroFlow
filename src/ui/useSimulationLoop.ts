/**
 * Loop de simulação.
 *
 * Aciona `requestAnimationFrame` enquanto a simulação está rodando, despachando um `TICK` por frame. O controle de velocidade (N ticks/frame) é aplicado
 * dentro do reducer, então aqui só precisamos disparar um TICK por quadro.
 */
import { useEffect, useRef } from 'react';
import type { Acao } from '../state/store';

export function useSimulationLoop(
  rodando: boolean,
  dispatch: React.Dispatch<Acao>,
): void {
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!rodando) return;
    const passo = (): void => {
      dispatch({ tipo: 'TICK' });
      frame.current = requestAnimationFrame(passo);
    };
    frame.current = requestAnimationFrame(passo);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [rodando, dispatch]);
}
