// `columnas` acepta strings (como antes, sin ordenar) u objetos { label, clave, ordenable }.
// Pasando ordenarPor/orden/onOrdenar se habilita el header clicable para las columnas
// ordenable:true — opt-in, no cambia el comportamiento de las pantallas que ya usan Table
// con columnas planas. `pie` renderiza contenido (p.ej. Paginacion) dentro del mismo
// contenedor con borde, como una fila de footer.
function Table({ columnas, children, ordenarPor, orden, onOrdenar, pie }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {columnas.map((col) => {
              const esObjeto = typeof col === 'object' && col !== null;
              const label = esObjeto ? col.label : col;
              const clave = esObjeto ? col.clave : null;
              const ordenable = esObjeto && col.ordenable && onOrdenar;
              return (
                <th key={label} className="px-4 py-3 font-medium text-gray-500">
                  {ordenable ? (
                    <button
                      type="button"
                      onClick={() => onOrdenar(clave)}
                      className="inline-flex items-center gap-1 hover:text-gray-700"
                    >
                      {label}
                      <span className="text-[10px] leading-none text-gray-400">
                        {ordenarPor === clave ? (orden === 'asc' ? '▲' : '▼') : ''}
                      </span>
                    </button>
                  ) : label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
      {pie}
    </div>
  );
}

export function Fila({ children, className = '' }) {
  return <tr className={`hover:bg-gray-50 ${className}`}>{children}</tr>;
}

export function Celda({ children, className = '' }) {
  return <td className={`px-4 py-3 text-gray-700 ${className}`}>{children}</td>;
}

export function TablaVacia({ colSpan, mensaje = 'Sin resultados.' }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-gray-400">
        {mensaje}
      </td>
    </tr>
  );
}

export default Table;
