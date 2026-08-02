# Notifyra (PWA + App)

PWA mobile-first para gestionar suscripciones personales con foco en claridad: total mensual/anual, próximos cobros y recordatorios.

## Stack

- React + TypeScript + Vite
- PWA con `vite-plugin-pwa`
- Supabase (auth + base de datos) con fallback local automático

## Requisitos (macOS)

- Node.js 20+
- npm 10+
- Xcode (para iOS)
- Android Studio + Android SDK (para Android)
- JDK 17+ (recomendado para Android)

## Instalación

```bash
npm install
npm run dev
```

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta el SQL de [supabase/schema.sql](supabase/schema.sql) en el SQL Editor.
3. Copia `.env.example` a `.env` y completa:

```bash
cp .env.example .env
```

Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Si no defines variables, la app funciona en modo local (sin sync en nube).

### Nuevo dominio de grupos (perfil + grupos)

El schema ya incluye tablas y RLS para:

- Perfil personal (`profiles` + `subscriptions`)
- Grupos (`groups`, `group_members`, `group_invites`)
- Gastos compartidos (`group_expenses`, `group_expense_participants`)
- Cobros mensuales y reparto (`expense_charge_instances`, `expense_charge_shares`)

También incluye la función SQL `public.get_group_monthly_balances(group_id, year, month)` para obtener balance mensual por miembro.

## Scripts

- `npm run dev` → desarrollo
- `npm run build` → build producción
- `npm run lint` → lint
- `npm run test` → tests unitarios
- `npm run preview` → previsualizar build
- `npm run mobile:build` → build web + sync Capacitor
- `npm run cap:open:ios` → abrir proyecto iOS en Xcode
- `npm run cap:open:android` → abrir proyecto Android en Android Studio

## Preparación App Store y Play Store

La misma base de código sirve para **App Store (iOS)** y **Play Store (Android)** con Capacitor.

### Identidad de app

- App name: `Notifyra`
- App ID (bundle/package): `com.notifyra.app`

### Flujo de build nativo

```bash
npm run mobile:build
```

Esto genera `dist/` y sincroniza cambios a `ios/` y `android/`.

### iOS (App Store)

```bash
npm run cap:open:ios
```

En Xcode:

1. Selecciona equipo (`Signing & Capabilities`).
2. Revisa `Bundle Identifier` (`com.notifyra.app`).
3. `Product > Archive`.
4. Sube a App Store Connect desde Organizer.

### Android (Play Store)

```bash
npm run cap:open:android
```

En Android Studio:

1. Sincroniza Gradle.
2. Genera `AAB` firmado (`Build > Generate Signed Bundle / APK > Android App Bundle`).
3. Sube el `.aab` en Play Console.

### Nota Android (JDK)

Si ves error de Java Runtime al sincronizar Android, instala JDK 17 y exporta `JAVA_HOME`.

## Instalación PWA en iPhone (Safari)

Safari → Compartir → Añadir a pantalla de inicio.
