import { useRef, useState } from 'react';
import { ImageIcon, Upload, X } from 'lucide-react';
import { redimensionarImagen } from '../../../shared/imagen';
import Button from '../../../shared/ui/Button';

const TAMANO_MAX_ARCHIVO = 8 * 1024 * 1024; // origen antes de redimensionar
const DIMENSION_MAX_IMAGEN_ARTICULO = 480; // px, lado más largo — de sobra para la tarjeta del POS

// Campo de imagen reusado en el alta (ArticuloNuevoPage) y en la edición (ArticulosPage):
// preview cuadrado + subir/quitar. Mismo patrón (canvas resize -> data URI) que el logo de
// EmpresaPage, sin almacenamiento en el backend.
function CampoImagenArticulo({ idInput, imagenUrl, onChange }) {
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  async function handleArchivo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > TAMANO_MAX_ARCHIVO) {
      setError('La imagen es demasiado grande (máximo 8MB).');
      return;
    }
    try {
      const dataUrl = await redimensionarImagen(file, DIMENSION_MAX_IMAGEN_ARTICULO);
      onChange(dataUrl);
    } catch (err) {
      setError(err.message || 'No se pudo procesar la imagen.');
    }
  }

  return (
    <div className="sm:col-span-2 flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        {imagenUrl ? (
          <img src={imagenUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon size={22} className="text-gray-300" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input ref={inputRef} id={idInput} type="file" accept="image/*" onChange={handleArchivo} className="hidden" />
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          <Upload size={16} /> {imagenUrl ? 'Cambiar imagen' : 'Subir imagen'}
        </Button>
        {imagenUrl && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-danger-600"
          >
            <X size={13} /> Quitar imagen
          </button>
        )}
        {error && <p className="text-xs text-danger-600">{error}</p>}
      </div>
    </div>
  );
}

export default CampoImagenArticulo;
