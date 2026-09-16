# Studio JR — turnos online

Sitio de reservas para **Studio JR** (Damian Jara, Zárate, Buenos Aires), conectado en tiempo real a un Google Sheet que hace de base de datos de turnos.

## Estructura

```
jara/
├── website/
│   ├── index.html         # el sitio (single-file: HTML + CSS + JS)
│   └── img/                # imágenes que usa el sitio (rutas relativas desde index.html)
├── apps-script/
│   └── Code.gs             # motor de turnos, vive dentro del Google Sheet
└── docs/
    └── GUIA-DEPLOY.md      # paso a paso para publicar / actualizar
```

Las imágenes van en `website/img/` (no en una carpeta `public/` aparte): es lo único que Render publica, así que cualquier imagen fuera de `website/` no se ve en el sitio.

## Cómo funciona

- **`website/index.html`** es una página estática (sin build, sin dependencias de servidor). El único punto de configuración es la constante `WEBAPP_URL` al principio del `<script>`, que apunta a la Web App de Apps Script.
- **`apps-script/Code.gs`** vive pegado dentro del Google Sheet ("Extensiones > Apps Script") y expone esa Web App: `GET` para consultar fechas/horarios disponibles, `POST` para crear una reserva. También sincroniza automáticamente las hojas **Turnos** (disponibilidad) y **Reservas** (bookings) en las dos direcciones, incluida la carga manual de una reserva directo en el Sheet.
- Si el sitio no puede contactar al Web App (todavía no publicado, sin conexión, etc.), cae a un estado de reserva por Instagram (`@studio_jr`) en vez de mostrar un formulario roto.

Horario del local: martes a sábado, 9:00–12:00 y 16:00–19:30. Se edita en `CONFIG.HORARIOS` dentro de `Code.gs`.

Ver `docs/GUIA-DEPLOY.md` para publicar el script y conectar todo.
