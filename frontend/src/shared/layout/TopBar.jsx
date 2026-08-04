import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, ChevronDown, LogOut, Package, Users, Truck, Receipt, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { buscarGlobal } from '../../modules/busqueda/api/busqueda.api';
import { formatoMoneda } from '../format';

function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

const CATEGORIAS = [
  {
    clave: 'articulos',
    titulo: 'Artículos',
    icono: Package,
    ruta: '/catalogo/articulos',
    termino: (a) => a.sku || a.nombre,
    principal: (a) => a.nombre,
    secundario: (a) => (a.sku ? `SKU ${a.sku}` : null),
  },
  {
    clave: 'clientes',
    titulo: 'Clientes',
    icono: Users,
    ruta: '/clientes',
    termino: (c) => c.nombre,
    principal: (c) => c.nombre,
    secundario: (c) => c.correo || c.telefono || null,
  },
  {
    clave: 'proveedores',
    titulo: 'Proveedores',
    icono: Truck,
    ruta: '/proveedores',
    termino: (p) => p.nombre,
    principal: (p) => p.nombre,
    secundario: (p) => p.correo || p.telefono || null,
  },
  {
    clave: 'ventas',
    titulo: 'Ventas',
    icono: Receipt,
    ruta: '/ventas/recientes',
    termino: (v) => v.folio,
    principal: (v) => `Folio ${v.folio}`,
    secundario: (v) => `${v.cliente?.nombre || 'Sin cliente'} · ${formatoMoneda(v.total)}`,
  },
];

function TopBar({ onAbrirMenu }) {
  const { usuario, rol, logout } = useAuth();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);

  useEffect(() => {
    const termino = texto.trim();
    if (termino.length < 2) {
      setResultados(null);
      setCargando(false);
      return undefined;
    }
    setCargando(true);
    const timeoutId = setTimeout(() => {
      buscarGlobal(termino)
        .then((r) => setResultados(r))
        .catch(() => setResultados(null))
        .finally(() => setCargando(false));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [texto]);

  useEffect(() => {
    function alClickAfuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', alClickAfuera);
    return () => document.removeEventListener('mousedown', alClickAfuera);
  }, []);

  function irAResultado(categoria, item) {
    setAbierto(false);
    setTexto('');
    setResultados(null);
    navigate(categoria.ruta, { state: { buscar: categoria.termino(item) } });
  }

  const hayResultados = resultados
    && CATEGORIAS.some((c) => (resultados[c.clave] || []).length > 0);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onAbrirMenu}
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      <div ref={contenedorRef} className="relative hidden flex-1 max-w-md sm:block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Buscar en Ventix..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setAbierto(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setAbierto(false); e.currentTarget.blur(); } }}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm
            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        {cargando && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
        )}

        {abierto && texto.trim().length >= 2 && (
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-card">
            {!resultados && cargando && (
              <p className="px-4 py-3 text-sm text-gray-400">Buscando...</p>
            )}
            {resultados && !hayResultados && (
              <p className="px-4 py-3 text-sm text-gray-400">Sin resultados para "{texto.trim()}".</p>
            )}
            {resultados && CATEGORIAS.map((categoria) => {
              const items = resultados[categoria.clave] || [];
              if (items.length === 0) return null;
              const Icono = categoria.icono;
              return (
                <div key={categoria.clave} className="py-1">
                  <p className="px-4 pt-1 pb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {categoria.titulo}
                  </p>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => irAResultado(categoria, item)}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50"
                    >
                      <Icono size={16} className="shrink-0 text-gray-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-gray-900">{categoria.principal(item)}</span>
                        {categoria.secundario(item) && (
                          <span className="block truncate text-xs text-gray-500">{categoria.secundario(item)}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
              {iniciales(usuario?.nombre)}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight text-gray-900">{usuario?.nombre}</p>
              <p className="text-xs leading-tight text-gray-500">{rol?.nombre}</p>
            </div>
            <ChevronDown size={16} className="text-gray-400" />
          </button>
          {menuAbierto && (
            <>
              <button
                aria-label="Cerrar menú de usuario"
                className="fixed inset-0 z-10"
                onClick={() => setMenuAbierto(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-card">
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LogOut size={16} />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopBar;
