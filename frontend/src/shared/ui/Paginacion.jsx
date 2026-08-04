import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

function Paginacion({ pagina, totalPaginas, total, onCambiar }) {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
      <span>{total} resultado{total === 1 ? '' : 's'} · página {pagina} de {totalPaginas}</span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onCambiar(pagina - 1)}
          disabled={pagina <= 1}
        >
          <ChevronLeft size={16} /> Anterior
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onCambiar(pagina + 1)}
          disabled={pagina >= totalPaginas}
        >
          Siguiente <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

export default Paginacion;
