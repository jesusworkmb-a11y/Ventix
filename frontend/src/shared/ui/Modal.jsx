import { X } from 'lucide-react';

function Modal({ abierto, onCerrar, titulo, children, ancho = 'max-w-lg' }) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Cerrar"
        className="fixed inset-0 bg-black/40"
        onClick={onCerrar}
      />
      <div className={`relative z-10 w-full ${ancho} max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-card`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;
