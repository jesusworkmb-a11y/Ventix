import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { buscarCatalogoSat } from '../../modules/facturacion/api/catalogosSat.api';

function etiqueta(item) {
  return `${item.clave} — ${item.descripcion}`;
}

// Combobox con búsqueda server-side sobre un catálogo SAT (régimen fiscal, uso CFDI, clave
// prod/serv, etc.) — mismo patrón de debounce/dropdown/click-afuera que el buscador global del
// TopBar, reusado acá porque catálogos como ClaveProdServ/ClaveUnidad tienen miles de filas (no
// se pueden mandar completas al navegador para un <select> nativo).
//
// `value` es la clave elegida (string) o null. El texto mostrado siempre se resuelve por
// separado (nunca se guarda la etiqueta como si fuera el valor) para no perder la clave real si
// el usuario edita el texto sin llegar a elegir un ítem de la lista.
// `buscarFn` es opcional -- por defecto pega al endpoint autenticado (buscarCatalogoSat). El
// portal público de autofacturación (sin login) pasa una variante propia que pega a
// /facturacion/portal-publico/catalogos-sat en su lugar, mismo shape (tipo, q, limite) => array.
function SelectorCatalogoSat({
  tipo, value, onChange, label, placeholder = 'Buscar…', error, required, id, buscarFn = buscarCatalogoSat,
}) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);

  // Mientras el dropdown está cerrado, el texto siempre debe reflejar el valor realmente
  // elegido (nunca lo que se haya tipeado buscando sin confirmar) — corre al montar, cuando
  // `value` cambia desde afuera (cargar un registro para editar) y cada vez que el dropdown se
  // cierra (click afuera, Escape, o tras elegir un ítem).
  useEffect(() => {
    if (abierto) return undefined;
    if (!value) {
      setTexto('');
      return undefined;
    }
    let cancelado = false;
    buscarFn(tipo, value, 1)
      .then((r) => {
        if (cancelado) return;
        const item = r.find((x) => x.clave === value);
        if (item) setTexto(etiqueta(item));
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [abierto, value, tipo]);

  useEffect(() => {
    if (!abierto) return undefined;
    setCargando(true);
    const timeoutId = setTimeout(() => {
      buscarFn(tipo, texto.trim(), 20)
        .then((r) => setResultados(r))
        .catch(() => setResultados([]))
        .finally(() => setCargando(false));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [texto, tipo, abierto]);

  useEffect(() => {
    function alClickAfuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', alClickAfuera);
    return () => document.removeEventListener('mousedown', alClickAfuera);
  }, []);

  function elegir(item) {
    onChange(item.clave);
    setAbierto(false);
  }

  function limpiar(e) {
    e.stopPropagation();
    onChange(null);
    setAbierto(false);
  }

  return (
    <div ref={contenedorRef} className="relative flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
          {required && ' *'}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type="text"
          value={texto}
          placeholder={placeholder}
          onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
          onFocus={() => { setAbierto(true); if (value) setTexto(''); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setAbierto(false); e.currentTarget.blur(); } }}
          className={`w-full rounded-lg border px-3 py-2 pr-8 text-sm text-gray-900 placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            ${error ? 'border-danger-400' : 'border-gray-300'}`}
        />
        {cargando && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
        )}
        {!cargando && value && (
          <button
            type="button"
            onClick={limpiar}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Quitar selección"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-danger-600">{error}</p>}

      {abierto && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-card">
          {resultados.length === 0 && !cargando && (
            <p className="px-4 py-3 text-sm text-gray-400">Sin resultados.</p>
          )}
          {resultados.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => elegir(item)}
              className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-gray-50"
            >
              <span className="text-sm text-gray-900">{item.clave}</span>
              <span className="truncate text-xs text-gray-500">{item.descripcion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SelectorCatalogoSat;
