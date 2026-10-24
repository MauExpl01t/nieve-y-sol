// Utilidades de texto que usan el navegador y el servidor.

// Letras con tilde que se tratan como su letra base al buscar ("tomas" encuentra "Tomás").
export const CON_TILDES = 'ÁÉÍÓÚÜÑáéíóúüñ';
export const SIN_TILDES = 'AEIOUUNaeiouun';

// Texto en minúsculas y sin tildes, para comparar sin distinguir mayúsculas ni acentos.
// En la base de datos se aplica lo mismo a la columna con sinTildesSql (src/db.js).
export function normalizarBusqueda(texto) {
  return [...texto.normalize('NFC')]
    .map((letra) => {
      const posicion = CON_TILDES.indexOf(letra);
      return posicion === -1 ? letra : SIN_TILDES[posicion];
    })
    .join('')
    .toLowerCase();
}

// Nombre de persona: empieza con una letra y solo tiene letras, espacios, punto, guion o apóstrofo.
// Rechaza números y símbolos como "<script>1234", que no son un nombre real.
const NOMBRE_PERSONA = /^\p{L}[\p{L}\p{M}'’. -]*$/u;

export const MENSAJE_NOMBRE_PERSONA = 'Usa solo letras, espacios, punto, guion o apóstrofo.';

export function nombrePersonaValido(texto) {
  return NOMBRE_PERSONA.test(texto);
}
