import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarAuditoria, listarUsuarios } from '../api/core.api';

const ENTIDADES = ['Empresa', 'Sucursal', 'Usuario', 'Rol', 'RolPermiso'];

function AuditoriaPage() {
  const [registros, setRegistros] = useState([]);
  const [usuariosPorId, setUsuariosPorId] = useState({});
  const [filtros, setFiltros] = useState({ entidad: '', desde: '', hasta: '' });
  const [error, setError] = useState('');

  function cargar(filtrosActuales) {
    setError('');
    const params = {};
    if (filtrosActuales.entidad) params.entidad = filtrosActuales.entidad;
    if (filtrosActuales.desde) params.desde = filtrosActuales.desde;
    // "Hasta" es solo fecha (input type=date); sin la hora, el backend compararía contra
    // medianoche y excluiría todo lo registrado ese mismo día después de las 00:00.
    if (filtrosActuales.hasta) params.hasta = `${filtrosActuales.hasta}T23:59:59.999`;
    listarAuditoria(params)
      .then(setRegistros)
      .catch((err) => setError(err.response?.data?.error || 'No se pudo cargar la bitácora.'));
  }

  useEffect(() => {
    cargar(filtros);
    listarUsuarios()
      .then((usuarios) => {
        const mapa = {};
        for (const u of usuarios) mapa[u.id] = u.nombre;
        setUsuariosPorId(mapa);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aplicarFiltros(e) {
    e.preventDefault();
    cargar(filtros);
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 900 }}>
      <p><Link to="/dashboard">← Volver al dashboard</Link></p>
      <h1>Bitácora de auditoría</h1>

      <form onSubmit={aplicarFiltros} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <label>
          Entidad
          <select
            value={filtros.entidad}
            onChange={(e) => setFiltros((f) => ({ ...f, entidad: e.target.value }))}
          >
            <option value="">Todas</option>
            {ENTIDADES.map((ent) => (
              <option key={ent} value={ent}>{ent}</option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input
            type="date"
            value={filtros.desde}
            onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={filtros.hasta}
            onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))}
          />
        </label>
        <button type="submit" style={{ alignSelf: 'flex-end' }}>Filtrar</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Fecha</th>
            <th style={{ textAlign: 'left' }}>Usuario</th>
            <th style={{ textAlign: 'left' }}>Acción</th>
            <th style={{ textAlign: 'left' }}>Entidad</th>
            <th style={{ textAlign: 'left' }}>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.creadoEn).toLocaleString()}</td>
              <td>{usuariosPorId[r.usuarioEjecutorId] || r.usuarioEjecutorId}</td>
              <td>{r.accion}</td>
              <td>{r.entidad}{r.entidadId ? ` (${r.entidadId.slice(0, 8)}…)` : ''}</td>
              <td>
                {(r.valoresAntes || r.valoresDespues) ? (
                  <details>
                    <summary>ver</summary>
                    {r.valoresAntes && <pre>Antes: {JSON.stringify(r.valoresAntes, null, 2)}</pre>}
                    {r.valoresDespues && <pre>Después: {JSON.stringify(r.valoresDespues, null, 2)}</pre>}
                  </details>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {registros.length === 0 && <p>Sin registros para los filtros seleccionados.</p>}
    </div>
  );
}

export default AuditoriaPage;
