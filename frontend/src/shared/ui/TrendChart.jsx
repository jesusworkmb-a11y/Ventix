const ANCHO = 640;
const ALTO = 220;
const PAD_IZQ = 56;
const PAD_INF = 28;
const PAD_SUP = 12;

function formatoCorto(valor) {
  if (valor >= 1000) return `$${(valor / 1000).toFixed(valor % 1000 === 0 ? 0 : 1)}k`;
  return `$${valor}`;
}

function TrendChart({ datos }) {
  const maxValor = Math.max(...datos.map((d) => d.total), 1);
  const escalaY = (v) => ALTO - PAD_INF - (v / maxValor) * (ALTO - PAD_INF - PAD_SUP);
  const pasoX = (ANCHO - PAD_IZQ - 16) / Math.max(datos.length - 1, 1);
  const escalaX = (i) => PAD_IZQ + i * pasoX;

  const puntos = datos.map((d, i) => [escalaX(i), escalaY(d.total)]);
  const linea = puntos.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `${PAD_IZQ},${ALTO - PAD_INF} ${linea} ${escalaX(datos.length - 1)},${ALTO - PAD_INF}`;

  const marcasY = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxValor * f));

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full" role="img" aria-label="Tendencia de ventas">
      {marcasY.map((v) => (
        <g key={v}>
          <line
            x1={PAD_IZQ}
            x2={ANCHO - 8}
            y1={escalaY(v)}
            y2={escalaY(v)}
            stroke="#f1f5f9"
            strokeWidth="1"
          />
          <text x={0} y={escalaY(v) + 4} fontSize="11" fill="#94a3b8">
            {formatoCorto(v)}
          </text>
        </g>
      ))}

      <polygon points={area} fill="url(#gradienteVentas)" />
      <polyline points={linea} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {puntos.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="#2563eb" stroke="white" strokeWidth="1.5" />
      ))}

      {datos.map((d, i) => (
        <text key={d.etiqueta} x={escalaX(i)} y={ALTO - 6} fontSize="11" fill="#94a3b8" textAnchor="middle">
          {d.etiqueta}
        </text>
      ))}

      <defs>
        <linearGradient id="gradienteVentas" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default TrendChart;
