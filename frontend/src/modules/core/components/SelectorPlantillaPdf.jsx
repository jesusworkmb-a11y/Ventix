import { Check } from 'lucide-react';
import { PLANTILLAS_INFO } from '../../../shared/pdf/plantillas';

// Galería de las 6 plantillas de documentos PDF — tarjetas seleccionables en vez de un <select>
// plano, para que se pueda "elegir la que más agrade" comparando nombre/descripción/paleta de
// cada una de un vistazo. La lista de plantillas viene de PLANTILLAS_INFO (un solo punto de
// verdad compartido con el motor de renderizado, ver shared/pdf/plantillas/index.js).
function SelectorPlantillaPdf({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {PLANTILLAS_INFO.map((p) => {
        const seleccionada = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={`flex flex-col gap-2.5 rounded-xl border p-4 text-left transition-colors
              ${seleccionada ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900">{p.nombre}</span>
              {seleccionada && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
                  <Check size={13} />
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              {[p.primario, p.secundario, p.acento].map((color, i) => (
                <span key={i} className="h-4 w-8 rounded-full border border-black/5" style={{ backgroundColor: color }} />
              ))}
            </div>
            <p className="text-xs leading-relaxed text-gray-500">{p.descripcion}</p>
          </button>
        );
      })}
    </div>
  );
}

export default SelectorPlantillaPdf;
