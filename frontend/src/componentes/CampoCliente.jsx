// Campo para elegir un cliente escribiendo su nombre o RUT. Muestra las coincidencias en la lista
// desplegable del navegador (<datalist>) y solo cuenta como elegido si el texto es exactamente una de
// las opciones. Busca en el servidor (hasta 10 resultados) y solo ofrece clientes activos, porque un
// cliente inactivo no puede reservar. Así funciona con cualquier cantidad de clientes.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useValorRetrasado } from '../hooks/useListado.js';
import { CampoTexto } from './Campos.jsx';
import { formatearRut } from '../../../compartido/rut.js';

// onCambio(clienteId): el id del cliente elegido, o '' mientras no haya uno elegido.
export function CampoCliente({ id, onCambio, error }) {
  const [texto, setTexto] = useState('');
  // resultado: las opciones de la última búsqueda y qué texto se buscó, para saber si "no hubo coincidencias"
  const [resultado, setResultado] = useState({ busqueda: null, opciones: [] }); // opciones: [{ id, etiqueta }]
  const { opciones } = resultado;
  const busqueda = useValorRetrasado(texto.trim(), 250);

  useEffect(() => {
    const control = new AbortController();
    const consulta = new URLSearchParams({ estado: 'activo', limite: '10' });
    if (busqueda) consulta.set('buscar', busqueda);
    api('GET', `/api/clientes?${consulta}`, undefined, control.signal)
      .then(({ datos }) => {
        setResultado({
          busqueda,
          opciones: datos.map((c) => ({ id: c.id, etiqueta: `${c.nombre} · ${formatearRut(c.rut)}` })),
        });
      })
      .catch(() => {}); // si falla, el servidor igual valida el cliente al guardar
    return () => control.abort();
  }, [busqueda]);

  function alEscribir(valor) {
    setTexto(valor);
    const elegido = opciones.find((opcion) => opcion.etiqueta === valor);
    onCambio(elegido ? elegido.id : '');
  }

  // Se buscó lo que hay escrito y el servidor no encontró ningún cliente activo.
  const sinCoincidencias = busqueda !== '' && resultado.busqueda === busqueda && opciones.length === 0;

  return (
    <>
      <CampoTexto
        id={id} nombre="cliente" etiqueta="Cliente" valor={texto} onCambio={alEscribir} error={error}
        list={`${id}-opciones`}
        ayuda={sinCoincidencias
          ? 'No hay clientes activos con ese nombre o RUT. Si es una persona nueva, créala antes en la sección Clientes.'
          : 'Escribe el nombre o el RUT y elige una opción de la lista.'}
      />
      <datalist id={`${id}-opciones`}>
        {opciones.map((opcion) => <option key={opcion.id} value={opcion.etiqueta} />)}
      </datalist>
    </>
  );
}
