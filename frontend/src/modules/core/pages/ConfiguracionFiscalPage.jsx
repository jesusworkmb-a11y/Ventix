import { useEffect, useState } from 'react';
import {
  listarSucursales, actualizarEmpresaFiscal, actualizarSucursalFiscal,
} from '../api/core.api';
import { useAuth } from '../../../shared/context/AuthContext';
import Card from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import SelectorCatalogoSat from '../../../shared/ui/SelectorCatalogoSat';
import Table, { Fila, Celda, TablaVacia } from '../../../shared/ui/Table';

const EDIT_SUCURSAL_VACIO = { rfc: '', razonSocial: '', regimenFiscalClave: null, codigoPostal: '' };

// null = hereda de Empresa (comportamiento "matriz"). Enviar null explícito limpia un override
// ya asignado -- mismo criterio que el resto de los campos "desasignables" del proyecto
// (Cliente.listaPrecioId, Articulo.sku, etc.).
function paraGuardar(valor) {
  const limpio = typeof valor === 'string' ? valor.trim() : valor;
  return limpio || null;
}

function ConfiguracionFiscalPage() {
  const { empresa, actualizarEmpresa } = useAuth();

  const [rfc, setRfc] = useState(empresa?.rfc || '');
  const [razonSocial, setRazonSocial] = useState(empresa?.razonSocial || '');
  const [regimenFiscalClave, setRegimenFiscalClave] = useState(empresa?.regimenFiscalClave || null);
  const [slugPublico, setSlugPublico] = useState(empresa?.slugPublico || '');
  const [errorEmpresa, setErrorEmpresa] = useState('');
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false);
  const [guardadoEmpresa, setGuardadoEmpresa] = useState(false);

  const [sucursales, setSucursales] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState(EDIT_SUCURSAL_VACIO);
  const [errorSucursal, setErrorSucursal] = useState('');

  function cargarSucursales() {
    listarSucursales().then(setSucursales).catch(() => {});
  }

  useEffect(() => {
    cargarSucursales();
  }, []);

  async function guardarEmpresa(e) {
    e.preventDefault();
    setErrorEmpresa('');
    setGuardadoEmpresa(false);
    setGuardandoEmpresa(true);
    try {
      const actualizada = await actualizarEmpresaFiscal({
        rfc: paraGuardar(rfc),
        razonSocial: paraGuardar(razonSocial),
        regimenFiscalClave,
        slugPublico: paraGuardar(slugPublico),
      });
      actualizarEmpresa(actualizada);
      setGuardadoEmpresa(true);
    } catch (err) {
      setErrorEmpresa(err.response?.data?.error || 'No se pudieron guardar los datos fiscales.');
    } finally {
      setGuardandoEmpresa(false);
    }
  }

  function iniciarEdicion(sucursal) {
    setEditandoId(sucursal.id);
    setErrorSucursal('');
    setEditForm({
      rfc: sucursal.rfc || '',
      razonSocial: sucursal.razonSocial || '',
      regimenFiscalClave: sucursal.regimenFiscalClave || null,
      codigoPostal: sucursal.codigoPostal || '',
    });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setErrorSucursal('');
  }

  async function guardarSucursal(id) {
    setErrorSucursal('');
    try {
      await actualizarSucursalFiscal(id, {
        rfc: paraGuardar(editForm.rfc),
        razonSocial: paraGuardar(editForm.razonSocial),
        regimenFiscalClave: editForm.regimenFiscalClave,
        codigoPostal: paraGuardar(editForm.codigoPostal),
      });
      setEditandoId(null);
      cargarSucursales();
    } catch (err) {
      setErrorSucursal(err.response?.data?.error || 'No se pudo actualizar la sucursal.');
    }
  }

  const urlPortal = slugPublico.trim()
    ? `${window.location.origin}/facturar/${slugPublico.trim()}`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Datos fiscales</h1>
        <p className="text-sm text-gray-500">
          RFC, régimen fiscal y lugar de expedición usados para emitir CFDI. Una sucursal sin
          datos propios factura con los de la empresa.
        </p>
      </div>

      <Card title="Empresa (emisor por defecto)">
        {errorEmpresa && (
          <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorEmpresa}</p>
        )}
        {guardadoEmpresa && (
          <p className="mb-3 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">Cambios guardados.</p>
        )}
        <form onSubmit={guardarEmpresa} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="rfcEmpresa"
              label="RFC"
              value={rfc}
              onChange={(e) => setRfc(e.target.value)}
              placeholder="XAXX010101000"
            />
            <Input
              id="razonSocialEmpresa"
              label="Razón social"
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
            />
            <SelectorCatalogoSat
              id="regimenFiscalEmpresa"
              tipo="RegimenFiscal"
              label="Régimen fiscal"
              value={regimenFiscalClave}
              onChange={setRegimenFiscalClave}
              placeholder="Buscar régimen fiscal…"
            />
            <Input
              id="slugPublicoEmpresa"
              label="Slug del portal de autofacturación"
              value={slugPublico}
              onChange={(e) => setSlugPublico(e.target.value.toLowerCase())}
              placeholder="mi-tienda"
            />
          </div>
          {urlPortal && (
            <p className="text-xs text-gray-500">
              Portal público: <span className="font-mono">{urlPortal}</span>
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={guardandoEmpresa}>Guardar cambios</Button>
          </div>
        </form>
      </Card>

      <Card title="Sucursales — override de facturación">
        <p className="mb-3 text-sm text-gray-500">
          Dejá los campos vacíos para que la sucursal facture con el RFC/régimen de la empresa.
          Completalos solo si esta sucursal emite bajo una razón social propia.
        </p>
        {errorSucursal && (
          <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{errorSucursal}</p>
        )}
        <Table columnas={['Sucursal', 'RFC', 'Razón social', 'Régimen fiscal', 'C.P. expedición', '']}>
          {sucursales.length === 0 && <TablaVacia colSpan={6} />}
          {sucursales.map((s) => (
            <Fila key={s.id}>
              {editandoId === s.id ? (
                <>
                  <Celda className="font-medium text-gray-800">{s.nombre}</Celda>
                  <Celda>
                    <Input
                      id={`rfcSucursal-${s.id}`}
                      value={editForm.rfc}
                      onChange={(e) => setEditForm((f) => ({ ...f, rfc: e.target.value }))}
                      placeholder="Hereda de la empresa"
                      className="w-36"
                    />
                  </Celda>
                  <Celda>
                    <Input
                      id={`razonSocialSucursal-${s.id}`}
                      value={editForm.razonSocial}
                      onChange={(e) => setEditForm((f) => ({ ...f, razonSocial: e.target.value }))}
                      placeholder="Hereda de la empresa"
                      className="w-40"
                    />
                  </Celda>
                  <Celda>
                    <SelectorCatalogoSat
                      id={`regimenSucursal-${s.id}`}
                      tipo="RegimenFiscal"
                      value={editForm.regimenFiscalClave}
                      onChange={(v) => setEditForm((f) => ({ ...f, regimenFiscalClave: v }))}
                      placeholder="Hereda de la empresa"
                    />
                  </Celda>
                  <Celda>
                    <Input
                      id={`cpSucursal-${s.id}`}
                      value={editForm.codigoPostal}
                      onChange={(e) => setEditForm((f) => ({ ...f, codigoPostal: e.target.value }))}
                      placeholder="—"
                      className="w-24"
                    />
                  </Celda>
                  <Celda className="text-right">
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => guardarSucursal(s.id)} className="text-sm text-primary-600 hover:underline">
                        Guardar
                      </button>
                      <button type="button" onClick={cancelarEdicion} className="text-sm text-gray-500 hover:underline">
                        Cancelar
                      </button>
                    </div>
                  </Celda>
                </>
              ) : (
                <>
                  <Celda className="font-medium text-gray-800">{s.nombre}</Celda>
                  <Celda>{s.rfc || <span className="text-gray-400">Hereda de la empresa</span>}</Celda>
                  <Celda>{s.razonSocial || <span className="text-gray-400">Hereda de la empresa</span>}</Celda>
                  <Celda>{s.regimenFiscalClave || <span className="text-gray-400">Hereda de la empresa</span>}</Celda>
                  <Celda>{s.codigoPostal || '—'}</Celda>
                  <Celda className="text-right">
                    <button type="button" onClick={() => iniciarEdicion(s)} className="text-sm text-primary-600 hover:underline">
                      Editar
                    </button>
                  </Celda>
                </>
              )}
            </Fila>
          ))}
        </Table>
      </Card>
    </div>
  );
}

export default ConfiguracionFiscalPage;
