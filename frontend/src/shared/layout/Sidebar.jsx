import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NAVEGACION } from './navigation';
import iconoBoxPos from '../../assets/brand/icono-boxpos-oscuro.png';

const CLAVE_COLAPSADO = 'ventix_sidebar_colapsado';

function itemVisible(item, permisos) {
  if (!item.permiso) return true;
  return permisos?.includes(item.permiso);
}

function grupoVisible(item, permisos) {
  if (!item.hijos) return itemVisible(item, permisos);
  return item.hijos.some((hijo) => itemVisible(hijo, permisos));
}

function Sidebar({ abierto, onCerrar }) {
  const { pathname } = useLocation();
  const { empresa, permisos } = useAuth();
  const [expandido, setExpandido] = useState(() => {
    const activo = NAVEGACION.find((item) => item.hijos?.some((h) => pathname.startsWith(h.to)));
    return activo?.label ?? null;
  });
  // Preferencia de escritorio, persistida entre sesiones. El overlay de mobile (abierto=true)
  // ignora esta preferencia a propósito -- ver `mostrarColapsado` más abajo -- así que abrir
  // el menú en un celular siempre muestra el menú completo, sin importar lo que se dejó
  // colapsado la última vez que se usó en escritorio.
  const [colapsado, setColapsado] = useState(() => localStorage.getItem(CLAVE_COLAPSADO) === 'true');

  function alternarColapsado() {
    setColapsado((c) => {
      const nuevo = !c;
      localStorage.setItem(CLAVE_COLAPSADO, String(nuevo));
      return nuevo;
    });
  }

  const mostrarColapsado = colapsado && !abierto;

  const puedeEditarEmpresa = permisos?.includes('administracion.empresa.editar');
  const ContenedorEmpresa = puedeEditarEmpresa ? Link : 'div';
  const propsEmpresa = puedeEditarEmpresa ? { to: '/administracion/empresa', onClick: onCerrar } : {};

  return (
    <>
      {abierto && (
        <button
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onCerrar}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-900 transition-transform
          lg:static lg:translate-x-0 lg:transition-[width]
          ${colapsado ? 'lg:w-20' : 'lg:w-64'}
          ${abierto ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`flex h-16 shrink-0 items-center gap-2 px-5 ${mostrarColapsado ? 'lg:justify-center lg:px-2' : ''}`}>
          <img src={iconoBoxPos} alt="BOX POS" className="h-8 w-8 shrink-0 object-contain" />
          <span className={`text-lg font-bold text-white ${mostrarColapsado ? 'lg:hidden' : ''}`}>BOX POS</span>
          <button
            type="button"
            onClick={alternarColapsado}
            aria-label={colapsado ? 'Expandir menú' : 'Contraer menú'}
            title={colapsado ? 'Expandir menú' : 'Contraer menú'}
            className={`hidden shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white lg:flex ${mostrarColapsado ? '' : 'ml-auto'}`}
          >
            {colapsado ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {NAVEGACION.filter((item) => grupoVisible(item, permisos)).map((item) => {
            const Icon = item.icon;
            const activo = pathname.startsWith(item.to) || item.hijos?.some((h) => pathname.startsWith(h.to));

            // Con el menú contraído no hay lugar para el submenú indentado, así que un grupo
            // se comporta como un link directo a su página principal (mismo criterio que un
            // item sin hijos) -- ver el resto del submenú solo con el menú expandido.
            if (!item.hijos || mostrarColapsado) {
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={onCerrar}
                  title={mostrarColapsado ? item.label : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                    ${mostrarColapsado ? 'lg:justify-center lg:px-2' : ''}
                    ${activo ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className={mostrarColapsado ? 'lg:hidden' : ''}>{item.label}</span>
                </Link>
              );
            }

            const hijosVisibles = item.hijos.filter((h) => itemVisible(h, permisos));
            const desplegado = expandido === item.label;

            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => setExpandido(desplegado ? null : item.label)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                    ${activo ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${desplegado ? 'rotate-180' : ''}`}
                  />
                </button>
                {desplegado && (
                  <div className="ml-8 mt-1 space-y-1 border-l border-white/10 pl-3">
                    {hijosVisibles.map((hijo) => (
                      <Link
                        key={hijo.to}
                        to={hijo.to}
                        onClick={onCerrar}
                        className={`block rounded-lg px-3 py-1.5 text-sm transition-colors
                          ${pathname === hijo.to ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`}
                      >
                        {hijo.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <ContenedorEmpresa
          {...propsEmpresa}
          title={mostrarColapsado ? (empresa?.nombreComercial || 'Mi empresa') : undefined}
          className={`flex items-center gap-2 border-t border-white/10 px-4 py-4 hover:bg-white/5 ${mostrarColapsado ? 'lg:justify-center lg:px-2' : ''}`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 text-gray-300">
            {empresa?.logoUrl ? (
              <img src={empresa.logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <Building2 size={16} />
            )}
          </div>
          <div className={`min-w-0 ${mostrarColapsado ? 'lg:hidden' : ''}`}>
            <p className="truncate text-sm font-medium text-white">{empresa?.nombreComercial || 'Mi empresa'}</p>
          </div>
        </ContenedorEmpresa>
      </aside>
    </>
  );
}

export default Sidebar;
