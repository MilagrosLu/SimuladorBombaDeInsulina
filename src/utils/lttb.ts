// ============================================================
// LTTB – Largest-Triangle-Three-Buckets downsampling
// ============================================================
// Reduce un array de N puntos a `threshold` puntos conservando
// la forma visual de la curva (picos y valles).
//
// Referencia: Sveinn Steinarsson (2013),
//   "Downsampling Time Series for Visual Representation"
//   https://skemman.is/handle/1946/15343
//
// CONSTANTES AJUSTABLES:
//   - El parámetro `threshold` controla la cantidad de puntos de salida.
//     Pasarlo desde el llamador (App.tsx: CHART_POINTS).
//
// Uso:
//   import { lttb } from '../utils/lttb';
//   const downsampled = lttb(data, 80, p => p.time, p => p.glucoseReal);
// ============================================================

/**
 * Reduce `data` a `threshold` puntos usando LTTB.
 *
 * @param data      Array de entrada (ordenado por X creciente)
 * @param threshold Cantidad de puntos de salida deseada (≥ 2)
 * @param getX      Función que extrae el valor X de un punto
 * @param getY      Función que extrae el valor Y de referencia
 *                  (usada para calcular área del triángulo;
 *                  elige la serie más importante visualmente)
 * @returns Array reducido. Si threshold >= data.length, devuelve data tal cual.
 */
export function lttb<T>(
  data: T[],
  threshold: number,
  getX: (p: T) => number,
  getY: (p: T) => number,
): T[] {
  const n = data.length;

  // Guard: sin datos suficientes para reducir
  if (threshold <= 0 || threshold >= n) return data;

  // Con threshold=2 solo se preservan el primer y último punto
  if (threshold === 2) return [data[0], data[n - 1]];

  const result: T[] = [];
  result.push(data[0]); // siempre incluir el primer punto

  // Tamaño de cada bucket (los buckets del medio, excluyendo primero y último)
  const bucketSize = (n - 2) / (threshold - 2);

  let selectedIdx = 0; // índice del punto seleccionado en el paso anterior

  for (let i = 0; i < threshold - 2; i++) {
    // ── Rango del bucket actual ────────────────────────────
    const currStart = Math.floor(i * bucketSize) + 1;
    const currEnd   = Math.min(Math.floor((i + 1) * bucketSize) + 1, n - 1);

    // ── Promedio del bucket siguiente (punto "lookahead") ──
    const nextStart = currEnd;
    const nextEnd   = Math.min(Math.floor((i + 2) * bucketSize) + 1, n - 1);
    let avgX = 0, avgY = 0;
    const nextLen = nextEnd - nextStart;
    for (let j = nextStart; j < nextEnd; j++) {
      avgX += getX(data[j]);
      avgY += getY(data[j]);
    }
    if (nextLen > 0) { avgX /= nextLen; avgY /= nextLen; }

    // ── Punto A: el seleccionado en el paso anterior ───────
    const ax = getX(data[selectedIdx]);
    const ay = getY(data[selectedIdx]);

    // ── Elegir el punto del bucket actual que forma el
    //    triángulo de mayor área con A y el promedio siguiente
    let maxArea = -1;
    let maxIdx  = currStart;

    for (let j = currStart; j < currEnd; j++) {
      // Área del triángulo (A, current, avgNext) × 0.5
      // La constante 0.5 se omite porque solo importa el orden relativo
      const area = Math.abs(
        (ax - avgX) * (getY(data[j]) - ay) -
        (ax - getX(data[j])) * (avgY - ay),
      );
      if (area > maxArea) {
        maxArea = area;
        maxIdx  = j;
      }
    }

    result.push(data[maxIdx]);
    selectedIdx = maxIdx;
  }

  result.push(data[n - 1]); // siempre incluir el último punto
  return result;
}
