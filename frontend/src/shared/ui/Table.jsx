function Table({ columnas, children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {columnas.map((col) => (
              <th key={col} className="px-4 py-3 font-medium text-gray-500">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
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
