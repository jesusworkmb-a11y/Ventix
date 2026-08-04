import { useRef, useState } from 'react';
import { Building2, Upload, X } from 'lucide-react';
import { actualizarEmpresa as actualizarEmpresaApi } from '../api/core.api';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';

const TAMANO_MAX_ARCHIVO = 8 * 1024 * 1024; // origen antes de redimensionar
const DIMENSION_MAX_LOGO = 320; // px, lado más largo — de sobra para sidebar/tickets/PDF

// No hay almacenamiento de archivos en el backend (mismo criterio que Articulo.imagenUrl):
// el logo se redimensiona/comprime acá mismo en un <canvas> y se manda como data URI (base64)
// dentro del JSON del PATCH, sin subir un binario a ningún lado.
function redimensionarImagen(file, maxDim) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
      img.onload = () => {
        const escala = Math.min(1, maxDim / Math.max(img.width, img.height));
        const ancho = Math.round(img.width * escala) || 1;
        const alto = Math.round(img.height * escala) || 1;
        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;
        canvas.getContext('2d').drawImage(img, 0, 0, ancho, alto);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  });
}

function EmpresaPage() {
  const { empresa, actualizarEmpresa } = useAuth();
  const [nombreComercial, setNombreComercial] = useState(empresa?.nombreComercial || '');
  const [logoUrl, setLogoUrl] = useState(empresa?.logoUrl || null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const inputArchivoRef = useRef(null);

  async function handleArchivo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setGuardado(false);
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > TAMANO_MAX_ARCHIVO) {
      setError('La imagen es demasiado grande (máximo 8MB).');
      return;
    }
    try {
      const dataUrl = await redimensionarImagen(file, DIMENSION_MAX_LOGO);
      setLogoUrl(dataUrl);
    } catch (err) {
      setError(err.message || 'No se pudo procesar la imagen.');
    }
  }

  function quitarLogo() {
    setLogoUrl(null);
    setGuardado(false);
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    setGuardado(false);
    if (!nombreComercial.trim()) {
      setError('El nombre comercial es obligatorio.');
      return;
    }
    setGuardando(true);
    try {
      const actualizada = await actualizarEmpresaApi({ nombreComercial: nombreComercial.trim(), logoUrl });
      actualizarEmpresa(actualizada);
      setGuardado(true);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Empresa</h1>
        <p className="text-sm text-gray-500">Nombre y logo que se muestran en la app y en los documentos.</p>
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {guardado && (
        <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">Cambios guardados.</p>
      )}

      <Card title="Datos de la empresa">
        <form onSubmit={guardar} className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo de la empresa" className="h-full w-full object-contain" />
              ) : (
                <Building2 size={28} className="text-gray-300" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={inputArchivoRef}
                type="file"
                accept="image/*"
                onChange={handleArchivo}
                className="hidden"
              />
              <Button type="button" variant="secondary" onClick={() => inputArchivoRef.current?.click()}>
                <Upload size={16} /> {logoUrl ? 'Cambiar logo' : 'Subir logo'}
              </Button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={quitarLogo}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-danger-600"
                >
                  <X size={13} /> Quitar logo
                </button>
              )}
            </div>
          </div>

          <Input
            id="nombreComercial"
            label="Nombre comercial"
            value={nombreComercial}
            onChange={(e) => setNombreComercial(e.target.value)}
            required
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={guardando}>Guardar cambios</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default EmpresaPage;
