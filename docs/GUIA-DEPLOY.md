# Cómo publicar / actualizar la agenda de Studio JR

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
