import { useRef, useState } from 'react';
import { Building2, Upload, X, Eye } from 'lucide-react';
import { actualizarEmpresa as actualizarEmpresaApi } from '../api/core.api';
import { useAuth } from '../../../shared/context/AuthContext';
import { redimensionarImagen } from '../../../shared/imagen';
import { formatoNumeroEmpresa } from '../../../shared/format';
import { urlVistaPrevia } from '../../../shared/pdf/motor';
import { construirDatosEjemplo } from '../../../shared/pdf/datosEjemplo';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import ColorPicker from '../../../shared/ui/ColorPicker';
import SelectorPlantillaPdf from '../components/SelectorPlantillaPdf';

const TAMANO_MAX_ARCHIVO = 8 * 1024 * 1024; // origen antes de redimensionar
const DIMENSION_MAX_LOGO = 320; // px, lado más largo — de sobra para sidebar/tickets/PDF

function EmpresaPage() {
  const { empresa, actualizarEmpresa } = useAuth();
  const [nombreComercial, setNombreComercial] = useState(empresa?.nombreComercial || '');
  const [logoUrl, setLogoUrl] = useState(empresa?.logoUrl || null);
  const [colorPrimario, setColorPrimario] = useState(empresa?.colorPrimario || null);
  const [colorSecundario, setColorSecundario] = useState(empresa?.colorSecundario || null);
  const [colorAcento, setColorAcento] = useState(empresa?.colorAcento || null);
  const [plantillaPdf, setPlantillaPdf] = useState(empresa?.plantillaPdf || 'CLASICA');
  const [datosBancarios, setDatosBancarios] = useState(empresa?.datosBancarios || '');
  const [terminosCondicionesPdf, setTerminosCondicionesPdf] = useState(empresa?.terminosCondicionesPdf || '');
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

  // Genera un PDF de ejemplo 100% en el navegador (sin guardar nada, sin pegarle al backend)
  // con la plantilla/colores que se están editando ahora mismo, para poder comparar las 6 antes
  // de decidir cuál dejar guardada.
  function verVistaPrevia() {
    const empresaVistaPrevia = {
      ...empresa,
      nombreComercial: nombreComercial.trim() || empresa?.nombreComercial,
      logoUrl,
      colorPrimario,
      colorSecundario,
      colorAcento,
      plantillaPdf,
      datosBancarios,
      terminosCondicionesPdf,
    };
    const datos = construirDatosEjemplo(empresaVistaPrevia);
    const url = urlVistaPrevia(datos);
    window.open(url, '_blank', 'noopener');
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
      const actualizada = await actualizarEmpresaApi({
        nombreComercial: nombreComercial.trim(),
        logoUrl,
        colorPrimario,
        colorSecundario,
        colorAcento,
        plantillaPdf,
        datosBancarios: datosBancarios.trim() || null,
        terminosCondicionesPdf: terminosCondicionesPdf.trim() || null,
      });
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
        <p className="text-sm text-gray-500">Nombre, logo y plantillas de documentos que se muestran en la app y en los PDF.</p>
        {empresa?.numero != null && (
          <p className="mt-1 text-xs text-gray-400">
            Número de empresa: <span className="font-mono font-medium text-gray-500">{formatoNumeroEmpresa(empresa.numero)}</span>
            {' '}— guardalo, lo vas a necesitar para recuperar el acceso si olvidás tu contraseña.
          </p>
        )}
      </div>

      {error && <p className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</p>}
      {guardado && (
        <p className="rounded-lg bg-success-50 px-4 py-2.5 text-sm text-success-700">Cambios guardados.</p>
      )}

      <form onSubmit={guardar} className="space-y-6">
        <Card title="Datos de la empresa">
          <div className="space-y-5">
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
          </div>
        </Card>

        <Card
          title="Plantillas de documentos PDF"
          action={(
            <Button type="button" variant="secondary" size="sm" onClick={verVistaPrevia}>
              <Eye size={15} /> Vista previa
            </Button>
          )}
        >
          <div className="space-y-6">
            <p className="text-sm text-gray-500">
              Elige el estilo con el que se generan Cotizaciones, Compras, Órdenes de compra y Facturas.
              Aplica a todos los documentos por igual.
            </p>
            <SelectorPlantillaPdf value={plantillaPdf} onChange={setPlantillaPdf} />

            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-900">Colores de marca (opcional)</h4>
              <div className="flex flex-wrap gap-5">
                <ColorPicker id="colorPrimario" label="Primario" value={colorPrimario} onChange={setColorPrimario} />
                <ColorPicker id="colorSecundario" label="Secundario" value={colorSecundario} onChange={setColorSecundario} />
                <ColorPicker id="colorAcento" label="Acento" value={colorAcento} onChange={setColorAcento} />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Si no se elige un color, cada plantilla usa su propia paleta por defecto.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="datosBancarios" className="text-sm font-medium text-gray-700">Datos bancarios (pie de página)</label>
                <textarea
                  id="datosBancarios"
                  rows={3}
                  value={datosBancarios}
                  onChange={(e) => setDatosBancarios(e.target.value)}
                  placeholder="Banco, CLABE, cuenta..."
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="terminosCondicionesPdf" className="text-sm font-medium text-gray-700">Términos y condiciones</label>
                <textarea
                  id="terminosCondicionesPdf"
                  rows={3}
                  value={terminosCondicionesPdf}
                  onChange={(e) => setTerminosCondicionesPdf(e.target.value)}
                  placeholder="Condiciones de pago, garantía, vigencia de precios..."
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={guardando}>Guardar cambios</Button>
        </div>
      </form>
    </div>
  );
}

export default EmpresaPage;
