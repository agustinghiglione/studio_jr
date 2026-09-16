# Cómo publicar / actualizar la agenda de Studio JR

## Arreglo importante: turnos duplicados / "no quedan horarios libres"
Si generaste los turnos antes de esta versión de `Code.gs`, es probable que la
columna "Hora inicio"/"Hora fin" de la hoja "Turnos" haya quedado guardada como
un valor de hora (en vez de texto plano "09:00"), porque esas columnas no tenían
forzado el formato de texto. Eso causaba dos síntomas: turnos duplicados (el
doble de los que corresponden) y que ningún horario apareciera al elegir un día
("No quedan horarios libres ese día"), aunque los turnos sí estuvieran cargados.

Para limpiarlo, con el `Code.gs` de este repo ya pegado en el editor:
1. Corré **`configurarHojas`** de nuevo (ahora también fuerza texto plano en
   las columnas de hora).
2. Corré **`reiniciarTurnos`** — borra los turnos que no tienen una reserva
   vinculada. Como todavía no hay reservas reales, esto limpia todos los
   duplicados de una.
3. Corré **`generarTurnos`** — recrea la agenda desde cero, ya con el formato
   correcto, sin duplicados.

## Si tu proyecto de Apps Script es standalone (no aparece el menú "Turnos")
Si al abrir el Sheet nunca ves el menú "Turnos" arriba, y "Extensiones > Apps Script"
no te lleva a nada, es porque el script no está atado al Sheet: es un proyecto
independiente en script.google.com. `Code.gs` ya funciona igual en los dos casos
(usa `CONFIG.SPREADSHEET_ID` como respaldo), pero como no hay menú, los pasos
cambian un poco:

1. Abrí tu proyecto en script.google.com (el link que tengas guardado, con
   `/d/.../edit`).
2. Pegá el `apps-script/Code.gs` de este repo (reemplazando todo) y guardá.
3. Arriba del editor, al lado de "Depurar", hay un desplegable de funciones.
   Elegí **`configurarHojas`** y clickeá ▶ **Ejecutar**. La primera vez Google
   va a pedir autorización (tu propio script sobre tu propio Sheet): aceptá,
   y si dice que la app "no está verificada", **Configuración avanzada > Ir a
   [proyecto] (no seguro) > Permitir**.
4. Elegí **`generarTurnos`** en el mismo desplegable y ▶ Ejecutar de nuevo.
5. Para que la sincronización automática funcione cuando alguien reserva a
   mano en el Sheet, elegí **`crearActivadorOnEdit`** en el desplegable de
   funciones y ▶ Ejecutar (el panel de Activadores no ofrece "Al editar" como
   opción para proyectos standalone, por eso esta función lo crea por código).
6. **Implementar > Administrar implementaciones** → ícono de lápiz (editar) en
   la implementación existente → en "Versión" elegí **Nueva versión** →
   Implementar. Así la URL `/exec` que ya está en `website/index.html` queda
   actualizada con este código, sin necesidad de generar una URL nueva.

## Si es la primera vez (todavía no corriste nada en el Sheet)
1. Abrí el Google Sheet **FormularioWeb**.
2. Menú **Extensiones > Apps Script**.
3. Borrá el contenido del archivo `Código.gs` y pegá el de `apps-script/Code.gs` de este proyecto.
4. Guardá (Ctrl/Cmd+S).
5. En el Sheet: **Archivo > Configuración** → Zona horaria: **(GMT-03:00) Argentina**. Guardar.
6. Recargá el Sheet (F5). Va a aparecer el menú **Turnos** arriba. La primera vez Google va a pedir autorización: aceptá (es tu propio script sobre tu propio Sheet).
7. Turnos > **🔧 Configurar hojas (una sola vez)**.
8. Turnos > **📅 Generar turnos**.
9. En el editor de Apps Script: **Implementar > Nueva implementación** → tipo **Aplicación web** → "Ejecutar como": **Yo** → "Quién tiene acceso": **Cualquier usuario** → Implementar. Si Google avisa que la app no está verificada (normal, es tuya): **Configuración avanzada > Ir a [proyecto] (no seguro) > Permitir**.
10. Copiá la URL que termina en `/exec` y pegala en `website/index.html`, en la línea `var WEBAPP_URL = "...";`.

## Ya lo tenías andando con el horario viejo — cómo actualizar
El horario cambió a **martes a sábado, 9 a 12 y 16 a 19:30** (antes era lunes a sábado corrido). Como ya habías generado turnos con el horario anterior, hay que refrescarlos:

1. En el Sheet: **Extensiones > Apps Script**, borrá todo el contenido de `Código.gs` y pegá de nuevo el `apps-script/Code.gs` actualizado de este proyecto (ya trae el horario partido y un ítem de menú nuevo).
2. Guardá y recargá el Sheet.
3. Turnos > **♻️ Reiniciar turnos (borra los que no tienen reserva)** — elimina los turnos viejos que nadie reservó; los que sí tienen una reserva confirmada quedan intactos.
4. Turnos > **📅 Generar turnos** — recrea la agenda con el horario nuevo.
5. No hace falta volver a implementar el Web App ni cambiar la URL: como quedó la misma implementación, sigue funcionando con la URL que ya tenías.

## Cómo se mantienen sincronizadas "Turnos" y "Reservas"
- Una reserva desde la **web** crea una fila en "Reservas" (Origen: Web) y marca el Turno como "Reservado" automáticamente.
- Si alguien carga una reserva **a mano** en "Reservas" (completa la columna "ID Turno" copiándolo desde la hoja Turnos), el script la completa y marca ese Turno como "Reservado" solo.
- Si cambiás el Estado de una reserva a "Cancelada", el Turno vuelve a "Disponible" solo.
- Si liberás un Turno a mano (Estado → "Disponible"), la reserva vinculada se cancela sola.

## Si querés un mail por cada reserva
En `apps-script/Code.gs`, cambiá `EMAIL_AVISO: ''` por tu email, ej. `EMAIL_AVISO: 'damian@ejemplo.com'`, guardá y volvé a pegarlo en Apps Script.
