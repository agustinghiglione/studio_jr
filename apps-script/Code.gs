/**
 * Studio JR — Motor de turnos (Google Apps Script)
 * ------------------------------------------------------------
 * Este script vive DENTRO del Google Sheet "FormularioWeb" (Extensiones > Apps Script).
 * Expone una Web App que el sitio consulta para:
 *   - listar fechas/horarios disponibles (GET)
 *   - crear una reserva (POST)
 * y mantiene sincronizadas las hojas "Turnos" y "Reservas" en ambos sentidos,
 * incluso cuando alguien reserva a mano directamente en el Sheet.
 *
 * NO hace falta tocar nada de este archivo para empezar: correr
 * "🔧 Configurar hojas" y luego "📅 Generar turnos" desde el menú "Turnos"
 * que aparece arriba del Sheet.
 */

// ============================================================
// CONFIGURACIÓN — lo único que probablemente quieras editar
// ============================================================
const CONFIG = {
  SHEET_TURNOS: 'Turnos',
  SHEET_RESERVAS: 'Reservas',
  ZONA_HORARIA: 'America/Argentina/Buenos_Aires',
  DURACION_TURNO_MIN: 30,
  SEMANAS_A_GENERAR: 6, // cuántas semanas hacia adelante genera "Generar turnos"

  // Horario real del local. 0 = Domingo ... 6 = Sábado. null = cerrado.
  // Cada día tiene una lista de turnos [inicio, fin] — permite horario partido (mañana/tarde).
  HORARIOS: {
    0: null,                                   // Domingo: cerrado
    1: null,                                   // Lunes: cerrado
    2: [['09:00', '12:00'], ['16:00', '19:30']], // Martes
    3: [['09:00', '12:00'], ['16:00', '19:30']], // Miércoles
    4: [['09:00', '12:00'], ['16:00', '19:30']], // Jueves
    5: [['09:00', '12:00'], ['16:00', '19:30']], // Viernes
    6: [['09:00', '12:00'], ['16:00', '19:30']], // Sábado
  },

  SERVICIO: {
    nombre: 'Corte de pelo',
    duracionMin: 30,
    precio: 15000,
    descripcion: 'Incluye ceja y barba',
  },

  // Si querés recibir un mail cada vez que entra una reserva desde la web,
  // poné tu dirección acá. Dejalo en '' para desactivar el aviso.
  EMAIL_AVISO: '',
};

// Columnas de la hoja Turnos
const COL_T = { ID: 1, FECHA: 2, DIA: 3, HORA_INICIO: 4, HORA_FIN: 5, ESTADO: 6, ID_RESERVA: 7 };
// Columnas de la hoja Reservas
const COL_R = {
  ID: 1, TIMESTAMP: 2, ID_TURNO: 3, FECHA: 4, HORA: 5,
  NOMBRE: 6, APELLIDO: 7, EMAIL: 8, TELEFONO: 9, OBSERVACIONES: 10,
  ORIGEN: 11, ESTADO: 12,
};

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ============================================================
// MENÚ
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Turnos')
    .addItem('🔧 Configurar hojas (una sola vez)', 'configurarHojas')
    .addItem('📅 Generar turnos (próximas ' + CONFIG.SEMANAS_A_GENERAR + ' semanas)', 'generarTurnos')
    .addItem('♻️ Reiniciar turnos (borra los que no tienen reserva)', 'reiniciarTurnos')
    .addSeparator()
    .addItem('🔗 Ver URL del Web App', 'mostrarUrlWebApp')
    .addToUi();
}

/**
 * Crea (o reordena) las hojas Turnos y Reservas con encabezados,
 * formato y validación de datos. Se puede correr varias veces sin romper nada.
 */
function configurarHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const turnos = ss.getSheetByName(CONFIG.SHEET_TURNOS) || ss.insertSheet(CONFIG.SHEET_TURNOS);
  const headersT = ['ID', 'Fecha', 'Día', 'Hora inicio', 'Hora fin', 'Estado', 'ID Reserva'];
  turnos.getRange(1, 1, 1, headersT.length).setValues([headersT]).setFontWeight('bold');
  turnos.setFrozenRows(1);
  turnos.autoResizeColumns(1, headersT.length);
  turnos.getRange(2, COL_T.FECHA, 3000, 1).setNumberFormat('@'); // texto plano: evita líos de huso horario
  aplicarValidacion_(turnos.getRange(2, COL_T.ESTADO, 2000, 1), ['Disponible', 'Reservado', 'Bloqueado']);

  const reservas = ss.getSheetByName(CONFIG.SHEET_RESERVAS) || ss.insertSheet(CONFIG.SHEET_RESERVAS);
  const headersR = ['ID Reserva', 'Registrado el', 'ID Turno', 'Fecha', 'Hora', 'Nombre', 'Apellido', 'Email', 'Teléfono', 'Observaciones', 'Origen', 'Estado'];
  reservas.getRange(1, 1, 1, headersR.length).setValues([headersR]).setFontWeight('bold');
  reservas.setFrozenRows(1);
  reservas.autoResizeColumns(1, headersR.length);
  reservas.getRange(2, COL_R.FECHA, 3000, 1).setNumberFormat('@'); // texto plano: evita líos de huso horario
  aplicarValidacion_(reservas.getRange(2, COL_R.ORIGEN, 2000, 1), ['Web', 'Manual']);
  aplicarValidacion_(reservas.getRange(2, COL_R.ESTADO, 2000, 1), ['Confirmada', 'Cancelada']);

  SpreadsheetApp.getActiveSpreadsheet().toast('Hojas "Turnos" y "Reservas" listas. Ahora corré "Generar turnos".', 'Configuración completa', 6);
}

function aplicarValidacion_(range, opciones) {
  const regla = SpreadsheetApp.newDataValidation().requireValueInList(opciones, true).setAllowInvalid(false).build();
  range.setDataValidation(regla);
}

/**
 * Genera los turnos disponibles de las próximas N semanas según CONFIG.HORARIOS,
 * sin duplicar los que ya existen (por fecha + hora).
 */
function generarTurnos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const turnos = ss.getSheetByName(CONFIG.SHEET_TURNOS);
  if (!turnos) {
    SpreadsheetApp.getUi().alert('Primero corré "Configurar hojas".');
    return;
  }

  const existentes = new Set();
  const ultimaFila = turnos.getLastRow();
  if (ultimaFila > 1) {
    const datos = turnos.getRange(2, 1, ultimaFila - 1, COL_T.ID_RESERVA).getValues();
    datos.forEach(function (fila) {
      const fecha = formatearFecha_(fila[COL_T.FECHA - 1]);
      const hora = fila[COL_T.HORA_INICIO - 1];
      existentes.add(fecha + '|' + hora);
    });
  }

  const filasNuevas = [];
  const hoy = new Date();
  const totalDias = CONFIG.SEMANAS_A_GENERAR * 7;

  for (let i = 0; i < totalDias; i++) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
    const diaSemana = fecha.getDay();
    const turnosDelDia = CONFIG.HORARIOS[diaSemana];
    if (!turnosDelDia) continue; // cerrado ese día

    const fechaTexto = formatearFecha_(fecha);
    turnosDelDia.forEach(function (rango) {
      const slots = generarSlots_(rango[0], rango[1], CONFIG.DURACION_TURNO_MIN);
      slots.forEach(function (slot) {
        const clave = fechaTexto + '|' + slot.inicio;
        if (existentes.has(clave)) return;
        const id = 'T-' + fechaTexto.replace(/-/g, '') + '-' + slot.inicio.replace(':', '');
        filasNuevas.push([id, fechaTexto, DIAS[diaSemana], slot.inicio, slot.fin, 'Disponible', '']);
        existentes.add(clave);
      });
    });
  }

  if (filasNuevas.length > 0) {
    turnos.getRange(turnos.getLastRow() + 1, 1, filasNuevas.length, 7).setValues(filasNuevas);
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(filasNuevas.length + ' turnos nuevos generados.', 'Listo', 5);
}

/**
 * Borra todos los turnos que NO tienen una reserva vinculada (para regenerar
 * limpio después de cambiar el horario, por ejemplo). Los turnos ya reservados
 * se dejan intactos para no perder reservas confirmadas.
 */
function reiniciarTurnos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const turnos = ss.getSheetByName(CONFIG.SHEET_TURNOS);
  if (!turnos) return;

  const ultimaFila = turnos.getLastRow();
  if (ultimaFila < 2) return;

  const datos = turnos.getRange(2, 1, ultimaFila - 1, 7).getValues();
  const filasAConservar = datos.filter(function (fila) {
    return fila[COL_T.ID_RESERVA - 1]; // tiene reserva -> se conserva
  });

  turnos.getRange(2, 1, ultimaFila - 1, 7).clearContent();
  if (filasAConservar.length > 0) {
    turnos.getRange(2, 1, filasAConservar.length, 7).setValues(filasAConservar);
  }

  SpreadsheetApp.getActiveSpreadsheet().toast('Turnos sin reserva eliminados. Corré "Generar turnos" para recrearlos con el horario actual.', 'Listo', 6);
}

function generarSlots_(horaInicio, horaFin, duracionMin) {
  const slots = [];
  let [h, m] = horaInicio.split(':').map(Number);
  const [hFin, mFin] = horaFin.split(':').map(Number);
  const minutosFin = hFin * 60 + mFin;

  while (h * 60 + m + duracionMin <= minutosFin) {
    const inicio = pad2_(h) + ':' + pad2_(m);
    let m2 = m + duracionMin;
    let h2 = h + Math.floor(m2 / 60);
    m2 = m2 % 60;
    const fin = pad2_(h2) + ':' + pad2_(m2);
    slots.push({ inicio: inicio, fin: fin });
    h = h2;
    m = m2;
  }
  return slots;
}

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

function formatearFecha_(valor) {
  // Si ya es un texto "yyyy-MM-dd" lo devolvemos tal cual: convertirlo a Date y
  // volver a formatearlo puede correr un día por husos horarios (bug clásico de Apps Script).
  if (typeof valor === 'string') {
    const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    valor = new Date(valor);
  }
  return Utilities.formatDate(valor, CONFIG.ZONA_HORARIA, 'yyyy-MM-dd');
}

function mostrarUrlWebApp() {
  const url = ScriptApp.getService().getUrl();
  const mensaje = url
    ? 'URL del Web App:\n\n' + url
    : 'Todavía no publicaste este script como Web App.\nImplementar > Nueva implementación > Aplicación web.';
  SpreadsheetApp.getUi().alert(mensaje);
}

// ============================================================
// WEB APP — lo que consume el sitio
// ============================================================

/**
 * GET ?accion=fechas                -> fechas con turnos disponibles + cantidad
 * GET ?accion=turnos&fecha=YYYY-MM-DD -> turnos disponibles de ese día
 * GET (sin parámetros)              -> info del servicio + próximas fechas disponibles
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  try {
    if (params.accion === 'turnos' && params.fecha) {
      return responderJSON_({ ok: true, turnos: obtenerTurnosDisponibles_(params.fecha) });
    }
    if (params.accion === 'fechas') {
      return responderJSON_({ ok: true, fechas: obtenerFechasDisponibles_() });
    }
    return responderJSON_({
      ok: true,
      servicio: CONFIG.SERVICIO,
      fechas: obtenerFechasDisponibles_(),
    });
  } catch (err) {
    return responderJSON_({ ok: false, error: String(err) });
  }
}

/**
 * POST body JSON: { idTurno, nombre, apellido, email, telefono, observaciones }
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return responderJSON_({ ok: false, error: 'El sistema está ocupado, probá de nuevo en unos segundos.' });
  }

  try {
    const datos = JSON.parse(e.postData.contents);
    const requeridos = ['idTurno', 'nombre', 'apellido', 'email', 'telefono'];
    for (const campo of requeridos) {
      if (!datos[campo] || String(datos[campo]).trim() === '') {
        return responderJSON_({ ok: false, error: 'Falta completar: ' + campo });
      }
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const turnos = ss.getSheetByName(CONFIG.SHEET_TURNOS);
    const filaTurno = buscarFilaPorId_(turnos, datos.idTurno, COL_T.ID);

    if (!filaTurno) {
      return responderJSON_({ ok: false, error: 'Ese turno ya no existe. Elegí otro horario.' });
    }
    const estadoActual = turnos.getRange(filaTurno, COL_T.ESTADO).getValue();
    if (estadoActual !== 'Disponible') {
      return responderJSON_({ ok: false, error: 'Ese turno ya fue reservado. Elegí otro horario.' });
    }

    const fecha = turnos.getRange(filaTurno, COL_T.FECHA).getValue();
    const fechaTexto = formatearFecha_(fecha);
    const hora = turnos.getRange(filaTurno, COL_T.HORA_INICIO).getValue();

    const reservas = ss.getSheetByName(CONFIG.SHEET_RESERVAS);
    const idReserva = 'R-' + new Date().getTime();
    reservas.appendRow([
      idReserva,
      new Date(),
      datos.idTurno,
      fechaTexto,
      hora,
      datos.nombre,
      datos.apellido,
      datos.email,
      datos.telefono,
      datos.observaciones || '',
      'Web',
      'Confirmada',
    ]);

    turnos.getRange(filaTurno, COL_T.ESTADO).setValue('Reservado');
    turnos.getRange(filaTurno, COL_T.ID_RESERVA).setValue(idReserva);

    enviarAvisoOpcional_(datos, fechaTexto, hora);

    return responderJSON_({
      ok: true,
      idReserva: idReserva,
      fecha: fechaTexto,
      hora: hora,
      servicio: CONFIG.SERVICIO.nombre,
    });
  } catch (err) {
    return responderJSON_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function enviarAvisoOpcional_(datos, fecha, hora) {
  if (!CONFIG.EMAIL_AVISO) return;
  try {
    MailApp.sendEmail(
      CONFIG.EMAIL_AVISO,
      'Nueva reserva: ' + datos.nombre + ' ' + datos.apellido,
      'Fecha: ' + fecha + '\nHora: ' + hora + '\nTeléfono: ' + datos.telefono + '\nEmail: ' + datos.email +
        '\nObservaciones: ' + (datos.observaciones || '-')
    );
  } catch (err) {
    // Si falla el mail no queremos romper la reserva.
  }
}

function obtenerFechasDisponibles_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const turnos = ss.getSheetByName(CONFIG.SHEET_TURNOS);
  const ultimaFila = turnos.getLastRow();
  if (ultimaFila < 2) return [];

  const datos = turnos.getRange(2, 1, ultimaFila - 1, 7).getValues();
  const hoyTexto = formatearFecha_(new Date());
  const conteo = {};

  datos.forEach(function (fila) {
    const estado = fila[COL_T.ESTADO - 1];
    if (estado !== 'Disponible') return;
    const fecha = formatearFecha_(fila[COL_T.FECHA - 1]);
    if (fecha < hoyTexto) return;
    conteo[fecha] = (conteo[fecha] || 0) + 1;
  });

  return Object.keys(conteo).sort().map(function (fecha) {
    return { fecha: fecha, disponibles: conteo[fecha] };
  });
}

function obtenerTurnosDisponibles_(fechaTexto) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const turnos = ss.getSheetByName(CONFIG.SHEET_TURNOS);
  const ultimaFila = turnos.getLastRow();
  if (ultimaFila < 2) return [];

  const datos = turnos.getRange(2, 1, ultimaFila - 1, 7).getValues();
  return datos
    .filter(function (fila) {
      return fila[COL_T.ESTADO - 1] === 'Disponible' && formatearFecha_(fila[COL_T.FECHA - 1]) === fechaTexto;
    })
    .map(function (fila) {
      return { id: fila[COL_T.ID - 1], horaInicio: fila[COL_T.HORA_INICIO - 1], horaFin: fila[COL_T.HORA_FIN - 1] };
    })
    .sort(function (a, b) {
      return a.horaInicio.localeCompare(b.horaInicio);
    });
}

function buscarFilaPorId_(hoja, id, columnaId) {
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return null;
  const ids = hoja.getRange(2, columnaId, ultimaFila - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return null;
}

function responderJSON_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// SINCRONIZACIÓN MANUAL — cuando alguien edita el Sheet a mano
// ============================================================

/**
 * Trigger simple de edición. Cubre dos casos:
 *  1) Alguien carga una reserva a mano en "Reservas" (completa ID Turno) ->
 *     completa los campos automáticos y marca el Turno como "Reservado".
 *  2) Alguien cambia el Estado de una reserva a "Cancelada" ->
 *     libera el Turno correspondiente (vuelve a "Disponible").
 *  3) Alguien cambia a mano el Estado de un Turno de "Reservado" a "Disponible" ->
 *     cancela la reserva vinculada, si existe.
 */
function onEdit(e) {
  try {
    const hoja = e.range.getSheet();
    const nombreHoja = hoja.getName();
    const fila = e.range.getRow();
    if (fila === 1) return; // encabezado

    if (nombreHoja === CONFIG.SHEET_RESERVAS) {
      sincronizarDesdeReservas_(hoja, fila, e.range.getColumn());
    } else if (nombreHoja === CONFIG.SHEET_TURNOS) {
      sincronizarDesdeTurnos_(hoja, fila, e.range.getColumn());
    }
  } catch (err) {
    // Nunca dejamos que un error de sincronización rompa la edición del usuario.
  }
}

function sincronizarDesdeReservas_(reservas, fila, columnaEditada) {
  const idTurno = reservas.getRange(fila, COL_R.ID_TURNO).getValue();

  // Caso: se cargó/editó el Estado a "Cancelada" -> liberar el turno.
  if (columnaEditada === COL_R.ESTADO) {
    const estado = reservas.getRange(fila, COL_R.ESTADO).getValue();
    if (estado === 'Cancelada' && idTurno) {
      liberarTurno_(idTurno);
    } else if (estado === 'Confirmada' && idTurno) {
      ocuparTurno_(idTurno, reservas.getRange(fila, COL_R.ID).getValue());
    }
    return;
  }

  // Caso: carga manual de una reserva nueva (se completó el ID Turno a mano).
  if (columnaEditada === COL_R.ID_TURNO && idTurno) {
    if (!reservas.getRange(fila, COL_R.ID).getValue()) {
      reservas.getRange(fila, COL_R.ID).setValue('R-' + new Date().getTime());
    }
    if (!reservas.getRange(fila, COL_R.TIMESTAMP).getValue()) {
      reservas.getRange(fila, COL_R.TIMESTAMP).setValue(new Date());
    }
    if (!reservas.getRange(fila, COL_R.ORIGEN).getValue()) {
      reservas.getRange(fila, COL_R.ORIGEN).setValue('Manual');
    }
    if (!reservas.getRange(fila, COL_R.ESTADO).getValue()) {
      reservas.getRange(fila, COL_R.ESTADO).setValue('Confirmada');
    }
    ocuparTurno_(idTurno, reservas.getRange(fila, COL_R.ID).getValue());
  }
}

function sincronizarDesdeTurnos_(turnos, fila, columnaEditada) {
  if (columnaEditada !== COL_T.ESTADO) return;
  const estado = turnos.getRange(fila, COL_T.ESTADO).getValue();
  const idTurno = turnos.getRange(fila, COL_T.ID).getValue();
  const idReserva = turnos.getRange(fila, COL_T.ID_RESERVA).getValue();

  if (estado === 'Disponible' && idReserva) {
    // Se liberó el turno a mano: cancelamos la reserva vinculada.
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reservas = ss.getSheetByName(CONFIG.SHEET_RESERVAS);
    const filaReserva = buscarFilaPorId_(reservas, idReserva, COL_R.ID);
    if (filaReserva) {
      reservas.getRange(filaReserva, COL_R.ESTADO).setValue('Cancelada');
    }
    turnos.getRange(fila, COL_T.ID_RESERVA).setValue('');
  }
}

function liberarTurno_(idTurno) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const turnos = ss.getSheetByName(CONFIG.SHEET_TURNOS);
  const filaTurno = buscarFilaPorId_(turnos, idTurno, COL_T.ID);
  if (filaTurno) {
    turnos.getRange(filaTurno, COL_T.ESTADO).setValue('Disponible');
    turnos.getRange(filaTurno, COL_T.ID_RESERVA).setValue('');
  }
}

function ocuparTurno_(idTurno, idReserva) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const turnos = ss.getSheetByName(CONFIG.SHEET_TURNOS);
  const filaTurno = buscarFilaPorId_(turnos, idTurno, COL_T.ID);
  if (filaTurno) {
    const estadoActual = turnos.getRange(filaTurno, COL_T.ESTADO).getValue();
    if (estadoActual !== 'Reservado') {
      turnos.getRange(filaTurno, COL_T.ESTADO).setValue('Reservado');
    }
    turnos.getRange(filaTurno, COL_T.ID_RESERVA).setValue(idReserva);
  }
}
