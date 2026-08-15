// Sin almacenamiento de archivos en el backend: una imagen se redimensiona/comprime acá mismo
// en un <canvas> y viaja como data URI (base64) dentro del JSON, sin subir un binario a ningún
// lado. Reusado por EmpresaPage (logo) y ArticulosPage (imagen de artículo).
export function redimensionarImagen(file, maxDim) {
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
