import clasica from './clasica';
import moderna from './moderna';
import ejecutiva from './ejecutiva';
import comercial from './comercial';
import catalogo from './catalogo';
import premium from './premium';

export const PLANTILLA_POR_DEFECTO = 'CLASICA';

export const PLANTILLAS = {
  CLASICA: clasica,
  MODERNA: moderna,
  EJECUTIVA: ejecutiva,
  COMERCIAL: comercial,
  CATALOGO: catalogo,
  PREMIUM: premium,
};

// Metadata para la galería de selección en EmpresaPage — un solo punto de verdad junto al
// registro de arriba, para no tener nombres/descripciones desincronizados del código real.
export const PLANTILLAS_INFO = [
  {
    id: 'CLASICA',
    nombre: 'Clásica Minimalista',
    descripcion: 'Simple, limpia y funcional. Fondo blanco, poco color, máxima legibilidad.',
    ...clasica.coloresPorDefecto,
  },
  {
    id: 'MODERNA',
    nombre: 'Profesional Moderna',
    descripcion: 'Corporativa contemporánea: banda de color, tarjetas informativas y jerarquía visual.',
    ...moderna.coloresPorDefecto,
  },
  {
    id: 'EJECUTIVA',
    nombre: 'Empresarial Ejecutiva',
    descripcion: 'Formal y elegante: tipografía serif, columnas anchas y espacios generosos.',
    ...ejecutiva.coloresPorDefecto,
  },
  {
    id: 'COMERCIAL',
    nombre: 'Comercial de Ventas',
    descripcion: 'Pensada para cerrar: total muy destacado y condiciones comerciales visibles.',
    ...comercial.coloresPorDefecto,
  },
  {
    id: 'CATALOGO',
    nombre: 'Visual con Productos',
    descripcion: 'Tarjetas por artículo con imagen, estilo catálogo digital / e-commerce.',
    ...catalogo.coloresPorDefecto,
  },
  {
    id: 'PREMIUM',
    nombre: 'Corporativa Premium',
    descripcion: 'Máximo impacto de marca: banner principal, logo grande y secciones diferenciadas.',
    ...premium.coloresPorDefecto,
  },
];

export function obtenerPlantilla(id) {
  return PLANTILLAS[id] || PLANTILLAS[PLANTILLA_POR_DEFECTO];
}
