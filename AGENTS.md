# Contexto permanente de Notifyra

Este archivo debe leerse completo antes de programar o proponer cambios en este repositorio.
Su objetivo es mantener continuidad tecnica y visual entre sesiones. Si una decision nueva
contradice este documento, se debe confirmar primero con el usuario y actualizar este archivo.

## Producto

Notifyra es una aplicacion para gestionar suscripciones, gastos recurrentes, grupos compartidos,
cobros mensuales y liquidaciones. La misma base React se publica como web/PWA y como aplicacion
nativa mediante Capacitor para iOS y Android.

La experiencia debe funcionar correctamente en:

- Movil: interfaz principal, navegacion inferior y areas seguras del dispositivo.
- Desktop: navegacion lateral y contenido responsive sin solapamientos.
- Tema claro y oscuro.
- Sesion local de desarrollo y sesion sincronizada con Supabase.

## Base tecnica

- React 19 y TypeScript.
- Vite.
- Supabase para autenticacion, datos y RPC.
- Capacitor para iOS y Android.
- Lucide React para iconos.
- CSS propio centralizado principalmente en `src/App.css`.
- Vitest para pruebas unitarias.
- Playwright para E2E movil y desktop.

No sustituir el sistema visual por MUI, Ant Design, Chakra, Bootstrap o una libreria de
componentes equivalente. Notifyra ya tiene una identidad propia y los cambios deben evolucionarla,
no reemplazarla por un aspecto generico.

## Estado visual actual

- Existe un sistema de tokens de color, superficies, bordes, radios y sombras en `src/App.css`.
- La navegacion es inferior en movil y lateral en desktop.
- Las vistas se seleccionan con `activeView` en `src/App.tsx`.
- La transicion actual `.screen > *` solo anima la entrada con `view-in`; no anima la salida ni
  representa la direccion de navegacion.
- El formulario nuevo ya tiene un gateway visual con logos y marquesinas.
- El dashboard, calendario, grupos, ajustes y listas son funcionales, pero necesitan mayor
  jerarquia, continuidad de movimiento y feedback tactil.
- El splash actual es basico y no adopta completamente el tema de la aplicacion.

## Direccion de diseno

La interfaz debe sentirse como una aplicacion financiera moderna, clara y fiable, no como un
dashboard web generico. Se priorizan:

- Jerarquia tipografica clara y cantidades faciles de leer.
- Movimiento breve, funcional y consistente.
- Profundidad moderada mediante superficies, contraste y sombras contenidas.
- Feedback inmediato al tocar, guardar, filtrar, eliminar o marcar pagos.
- Estados vacios y de carga que expliquen la siguiente accion.
- Coherencia entre splash, autenticacion, dashboard, navegacion y formularios.
- Accesibilidad y respeto por `prefers-reduced-motion`.

Evitar:

- Animaciones decorativas largas o que bloqueen acciones.
- Exceso de gradientes, cristal, sombras o tarjetas dentro de tarjetas.
- Cambiar toda la paleta sin una razon de producto.
- Animar propiedades costosas cuando se pueda usar `transform` y `opacity`.
- Introducir dependencias grandes para resolver efectos simples de CSS.

## Decision sobre animaciones

La libreria recomendada para la evolucion visual es `motion`, importada desde `motion/react`.
Debe usarse para transiciones con entrada y salida, layout compartido, listas y gestos. CSS debe
seguir usandose para hover, focus, cambios de color y efectos autocontenidos simples.

No usar GSAP ni React Spring salvo que aparezca una necesidad concreta que Motion no cubra.
La View Transition API puede estudiarse mas adelante como mejora progresiva, pero no debe ser la
base porque la aplicacion tambien se ejecuta mediante Capacitor.

## Fases de mejora visual

Las fases se ejecutan en este orden. No avanzar a la siguiente sin verificar la anterior en movil,
desktop, tema claro y tema oscuro. Al completar una fase, actualizar su estado en este archivo.

### Fase 1 - Sistema de movimiento

Estado: completada.

Implementacion vigente:

- `src/components/ViewTransition.tsx` coordina entrada, salida, foco y scroll.
- Las pestanas usan una entrada suave de 180 ms, sin barrido lateral ni escalado: opacidad
  `0.96 -> 1` y desplazamiento vertical de solo 2 px.
- `form` conserva una transicion vertical breve de 12 px por ser una accion independiente.
- `AnimatePresence` usa `popLayout`; la vista saliente pierde interaccion durante la salida.
- `prefers-reduced-motion` elimina desplazamientos de Motion y reduce animaciones CSS globales.
- Existe cobertura E2E de navegacion rapida con movimiento reducido en movil y desktop.

Objetivo: crear una base consistente para todas las animaciones.

- Instalar `motion`.
- Crear un wrapper reutilizable para transiciones de vistas.
- Sustituir la entrada CSS global `.screen > *` por entrada y salida coordinadas.
- Mantener el cambio entre pestanas suave, estable y sin barridos que fatiguen la vista.
- Tratar `form` como una accion/modal que entra desde abajo, no como otra pestana plana.
- Mantener la navegacion usable durante cambios rapidos.
- Respetar `prefers-reduced-motion` y evitar animacion inicial innecesaria.
- Mantener foco, scroll y lectores de pantalla en un estado predecible.

Criterios de aceptacion:

- No hay parpadeos ni contenido duplicado interactuable durante la transicion.
- Cambiar rapido entre pestanas no deja vistas antiguas visibles.
- La navegacion E2E existente sigue pasando en movil y desktop.
- La animacion se desactiva o reduce cuando el sistema lo solicita.

### Fase 2 - Navegacion premium

Estado: completada.

Implementacion vigente:

- El indicador activo usa `layoutId="primary-nav-active"` y tween de 200 ms sin rebote.
- En movil se representa como una linea superior; en desktop como una superficie contenida.
- `prefers-reduced-motion` convierte el movimiento del indicador en cambio instantaneo.
- Los iconos activos escalan solo a `1.05` y la pulsacion reduce temporalmente su escala.
- `Nuevo` mantiene 44 px, fondo de acento en movil y tratamiento de accion principal en desktop.
- `Ajustes` permanece fuera de la barra movil y visible en el sidebar desktop.
- Los E2E exigen un unico indicador activo y cubren navegacion movil y desktop.

Objetivo: dar continuidad visual y feedback claro a la navegacion principal.

- Anadir un indicador activo animado en la barra inferior.
- Reutilizar el mismo concepto en el sidebar desktop.
- Animar iconos activos con una escala minima y controlada.
- Mejorar el estado tactil de los botones sin depender de hover.
- Dar mayor protagonismo a `Nuevo` sin romper el equilibrio de la barra.
- Mantener `Ajustes` visible solo donde corresponda segun el layout actual.

Criterios de aceptacion:

- El indicador siempre coincide con `activeView`.
- No altera el ancho ni provoca saltos de texto o iconos.
- Las areas tactiles siguen teniendo al menos 44 px.

### Fase 3 - Inicio y dashboard

Estado: completada.

Implementacion vigente:

- `dash-hero2` usa una superficie tematica contenida, estado mensual y jerarquia financiera clara.
- El importe se actualiza con opacidad y 3 px verticales durante 200 ms, sin conteo ni barrido.
- Los importes de mas de 10 caracteres reducen su escala para evitar desbordamientos.
- Los KPIs entran con un escalonado maximo de 25 ms entre elementos.
- Las barras de presupuesto y pagos animan desde su valor anterior con tween de 350 ms.
- Vencidos usa una superficie de peligro diferenciada y `Proximos cobros` conserva menor prioridad.
- El estado vacio de proximos cobros aporta contexto y acceso directo al calendario.
- La revision visual cubre movil y desktop en temas claro y oscuro.

Objetivo: convertir el inicio en la pantalla con mayor identidad y claridad del producto.

- Redisenar `dash-hero2` con mejor jerarquia y fondo sutil ligado al tema.
- Animar la cantidad mensual al cargar y al cambiar de contexto.
- Escalonar la entrada de KPIs sin retrasar la interaccion.
- Animar barras de presupuesto y resumen mensual desde su valor anterior.
- Destacar cobros de hoy y pagos vencidos con prioridad visual real.
- Mejorar estados vacios con mensaje, contexto y accion recomendada.
- Reducir repeticion de cajas y bordes, especialmente en desktop.

Criterios de aceptacion:

- El importe y el estado del mes se entienden en pocos segundos.
- El dashboard conserva legibilidad con importes largos y distintos idiomas/monedas.
- No se produce layout shift al cargar logos o datos.

### Fase 4 - Listas, calendario y grupos

Estado: completada.

Implementacion vigente:

- Suscripciones anima altas, bajas y cambios de filtro con `AnimatePresence` y layout de posicion;
  las listas de mas de 40 elementos omiten el layout animation para proteger rendimiento.
- El panel de filtros coordina altura y opacidad durante 180 ms y expone estado accesible mediante
  `aria-expanded` y `aria-controls`.
- El calendario usa siempre 42 celdas para conservar dimensiones entre meses; el cambio mensual
  indica direccion con solo 6 px y el detalle diario entra con 2 px.
- Marcar un cobro actualiza estado y opacidad durante 180 ms, sin bloquear la accion.
- Formularios, feedback y detalle de grupos usan transiciones de opacidad y hasta 3 px.
- Listas, calendario y grupos comparten el patron visual `collection-empty` para estados vacios.
- `prefers-reduced-motion` elimina desplazamientos y duraciones de estas interacciones.
- La cobertura E2E valida filtros, 42 celdas, altura mensual estable y feedback de pago en movil y
  desktop; la revision visual cubre ambas plataformas en temas claro y oscuro.

Objetivo: hacer fluidas las operaciones frecuentes y los cambios de datos.

- Animar altas, eliminaciones y reordenaciones de suscripciones con layout animations.
- Animar la apertura/cierre de filtros y los resultados al filtrar.
- Anadir feedback visual al marcar cobros como pagados.
- Animar el cambio de mes del calendario segun la direccion.
- Mejorar seleccion de dia y transicion del detalle diario.
- Animar formularios y detalle de grupo sin mover contenido de forma brusca.
- Unificar estados vacios de listas, calendario, grupos e invitaciones.

Criterios de aceptacion:

- Filtrar o eliminar no provoca saltos bruscos.
- El calendario mantiene seleccion, foco y dimensiones estables.
- Las animaciones no degradan listas largas.

### Fase 5 - Formularios, modales y feedback

Estado: completada.

Implementacion vigente:

- El gateway y el formulario coordinan salida y entrada durante 160 ms; al terminar, el foco pasa
  a la busqueda de App Store o al campo de nombre segun el tipo de alta.
- Resultados de apps y financieras animan opacidad y hasta 3 px, limpian resultados obsoletos y
  exponen carga, errores y expansion con semantica accesible.
- `src/components/ModalSurface.tsx` unifica confirmaciones, invitaciones, notificaciones y alertas
  mediante portal tematico, sheet movil y dialogo centrado en desktop.
- El primitivo modal controla foco inicial, Escape, ciclo de Tab, bloqueo del fondo y scroll, cierre
  por overlay y devolucion de foco; las acciones pendientes impiden cierres inseguros.
- Eliminacion de suscripciones, borrado local, eliminacion de cuenta y liquidaciones mantienen los
  errores junto a su accion. Guardado, importacion y liquidacion usan regiones de estado o alerta.
- Los selectores visuales del formulario publican su seleccion con `aria-pressed` y los resultados
  devuelven el foco a un campo estable despues de elegir una opcion.
- Los E2E validan foco del gateway, busqueda animada, Escape, devolucion de foco y retirada completa
  del dialogo en movil y desktop; la revision visual cubre claro y oscuro.

Objetivo: mejorar creacion, edicion y confirmaciones.

- Hacer una transicion continua desde el gateway de nueva suscripcion al formulario.
- Animar resultados de busqueda de apps y proveedores.
- Convertir modales moviles en sheets coherentes con entrada y salida.
- Unificar overlays, dialogos de confirmacion y panel de notificaciones.
- Anadir estados de guardando, exito y error sin bloquear innecesariamente.
- Revisar foco inicial, tecla Escape y devolucion de foco al cerrar.

Criterios de aceptacion:

- Crear, editar y eliminar sigue pasando en E2E.
- Ningun modal queda visible o interactuable despues de cerrarse.
- Los errores se muestran junto a la accion que los produjo.

### Fase 6 - Splash y autenticacion

Estado: completada.

Implementacion vigente:

- El splash usa `app-shell` y tokens de tema para evitar fondo blanco fijo en modo oscuro.
- La entrada del splash dura menos y respeta `prefers-reduced-motion` mediante la regla global.
- El login tiene jerarquia propia con marca, titulo contextual, highlights y formulario en superficie.
- Los estados de carga, error y exito usan regiones `status`/`alert` accesibles junto al formulario.
- Google se muestra cuando Supabase esta disponible salvo `VITE_AUTH_GOOGLE_ENABLED=false`.
- Apple permanece oculto salvo `VITE_AUTH_APPLE_ENABLED=true`, porque requiere Apple Developer y Supabase.
- Las invitaciones pendientes siguen visibles antes de autenticar y se aceptan despues del login/registro.

Objetivo: alinear la primera impresion con la aplicacion principal.

- Adaptar el splash al tema y evitar el fondo blanco fijo.
- Mejorar logo, entrada y salida sin aumentar el tiempo percibido.
- Refinar la jerarquia del login y los botones Google/Apple.
- Mostrar solo proveedores OAuth realmente configurados.
- Mejorar estados de redireccion, carga y error OAuth.
- Conservar invitaciones pendientes durante el flujo de autenticacion.

Criterios de aceptacion:

- No hay flash blanco en tema oscuro.
- El callback OAuth termina en una pantalla estable y autenticada.
- El login sigue siendo usable con teclado y lector de pantalla.

### Fase 7 - Pulido y validacion visual

Estado: completada.

Implementacion vigente:

- Playwright ejecuta los flujos principales en movil, desktop y tablet Chromium.
- Los tests E2E fallan ante errores de consola o `pageerror`; los recursos externos mockeados se interceptan para evitar ruido de red.
- La cobertura mantiene validaciones de navegacion, layout desktop, calendario estable, filtros, formularios y movimiento reducido.
- La validacion final exige `lint`, `build`, unit tests y E2E completos antes de cerrar cambios visuales.

Objetivo: cerrar inconsistencias y prevenir regresiones.

- Revisar espaciado, radios, sombras y jerarquia tipografica global.
- Eliminar reglas CSS duplicadas u obsoletas solo cuando su uso se haya comprobado.
- Anadir capturas o pruebas visuales representativas si aportan estabilidad.
- Probar anchos movil, tablet, desktop y contenido largo.
- Revisar rendimiento, animaciones simultaneas y layout shifts.
- Validar temas claro/oscuro y `prefers-reduced-motion`.

Criterios de aceptacion:

- No hay solapamientos en los viewports cubiertos por Playwright.
- No hay errores de consola durante los flujos principales.
- Build, lint, unit tests y E2E terminan correctamente.

## Flujo obligatorio al programar

Antes de editar:

1. Leer este archivo.
2. Revisar `git status` y no modificar cambios ajenos sin necesidad.
3. Leer los componentes y estilos afectados antes de decidir la solucion.
4. Identificar la fase activa y limitar el alcance a esa fase.

Durante la implementacion:

1. Preferir el cambio correcto mas pequeno.
2. Mantener la identidad actual y reutilizar tokens existentes.
3. Probar tanto interaccion tactil como teclado cuando aplique.
4. No mezclar un rediseno completo con cambios funcionales no relacionados.
5. Anadir nuevas dependencias solo con una justificacion concreta.

Despues de editar:

1. Ejecutar `npm run lint`.
2. Ejecutar `npm run build`.
3. Ejecutar `npm test` si cambia logica o componentes con pruebas.
4. Ejecutar `npm run test:e2e` si cambia navegacion, layout o flujos principales.
5. Revisar manualmente movil y desktop cuando el cambio sea visual.
6. Actualizar el estado de la fase y anotar decisiones duraderas en este archivo.

## Archivos clave

- `src/App.tsx`: composicion principal, navegacion y seleccion de vistas.
- `src/App.css`: tokens, layout, temas, responsive y estilos principales.
- `src/components/AuthScreen.tsx`: autenticacion y proveedores OAuth.
- `src/views/DashboardView.tsx`: inicio y resumen financiero.
- `src/views/SubscriptionsView.tsx`: listado, filtros y acciones.
- `src/views/FormView.tsx`: gateway, busqueda, alta y edicion.
- `src/views/TimelineView.tsx`: calendario y pagos diarios.
- `src/views/GroupsView.tsx`: grupos, miembros e invitaciones.
- `src/views/SettingsView.tsx`: preferencias, cuenta y datos.
- `e2e/app.spec.ts`: flujos principales y cobertura de layout.
- `playwright.config.ts`: proyectos movil y desktop.

## Contexto de Supabase y autenticacion

- Google OAuth esta implementado en la interfaz y en `useAuth`.
- Supabase necesita tener Google habilitado y las URLs de retorno configuradas.
- Apple aparece en la interfaz, pero requiere configuracion de Apple Developer y Supabase.
- Las migraciones SQL se encuentran en `supabase/migrations`.
- No ejecutar `supabase/schema.sql` sobre una base existente salvo que se confirme expresamente.

## Regla de continuidad

Cuando se descubra una restriccion, decision visual o deuda tecnica que afecte a futuras sesiones,
se debe anadir aqui de forma breve. Este archivo no es un diario: debe contener solo contexto vigente,
decisiones duraderas, fases y criterios que ayuden a continuar el trabajo correctamente.
