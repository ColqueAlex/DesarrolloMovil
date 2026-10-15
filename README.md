# Login y SignUp — proyecto para alumnos

Proyecto Expo en JavaScript para practicar registro, inicio y cierre de sesión con Firebase Authentication. Las credenciales están vacías para que cada alumno conecte su propio proyecto Firebase.

## Requisitos

- Node.js 22 LTS. Expo SDK 57 requiere Node.js 22.13 o posterior.
- npm, incluido con Node.js.
- Expo Go actualizado en el teléfono.
- Una cuenta de Firebase.

Para comprobar la instalación en CMD o PowerShell:

```text
node -v
npm -v
```

## 1. Preparar el proyecto

1. Descomprimir el ZIP.
2. Abrir la carpeta `login-signup-alumnos` en Visual Studio Code.
3. Abrir una terminal dentro de esa carpeta.
4. Instalar exactamente las dependencias registradas en `package-lock.json`:

```text
npm ci
```

Si `npm ci` indica que faltan archivos o que el lockfile no coincide, usar `npm install`.

## 2. Crear y configurar Firebase

1. Crear un proyecto en <https://console.firebase.google.com/>.
2. En la descripción general, pulsar **Agregar app** y elegir Web `</>`.
3. Escribir un alias. No es necesario habilitar Firebase Hosting.
4. Registrar la aplicación y conservar el objeto `firebaseConfig`.
5. Entrar en **Authentication > Método de acceso**.
6. Agregar y habilitar **Correo electrónico/contraseña**.

## 3. Agregar la configuración Firebase

En CMD de Windows:

```text
copy .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Abrir `.env` y completar los seis valores de `firebaseConfig`:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

Copiar los valores exactamente y respetar mayúsculas y minúsculas. No agregar comillas, comas ni punto y coma. `.env` está excluido de Git.

## 4. Ejecutar la aplicación

```text
npm start
```

La computadora y el teléfono deben estar conectados a la misma red Wi-Fi. Cuando aparezca el código QR, abrir Expo Go y escanearlo.

Si el teléfono no logra conectarse por la red local, detener Expo con `Ctrl+C` y utilizar el túnel:

```text
npm run start:tunnel
```

Para detener el servidor, presionar `Ctrl+C`.

## 5. Prueba funcional

1. Registrar un usuario con nombre, apellido, correo y contraseña.
2. La contraseña debe tener al menos seis caracteres, una mayúscula, una minúscula y un número; por ejemplo, `Prueba123`.
3. Confirmar que aparece **Inicio**.
4. Comprobar el usuario en **Firebase > Authentication > Usuarios**.
5. Cerrar sesión e iniciar sesión con la misma cuenta.
6. Cerrar y volver a abrir Expo Go para comprobar que la sesión se conserva.

## Soluciones rápidas

- **Falta configurar Firebase:** revisar que exista `.env` y que sus seis valores estén completos.
- **Clave API no válida:** copiar `apiKey` otra vez y respetar mayúsculas y minúsculas.
- **El QR no conecta:** ejecutar `npm run start:tunnel`.
- **Error de caché o cambios que no aparecen:** ejecutar `npx expo start -c`.
- **Puerto ocupado:** cerrar otra instancia de Expo o aceptar el puerto alternativo propuesto.

## Docker opcional

Los archivos `Dockerfile` y `compose.yaml` permiten ejecutar el mismo proyecto con Docker, pero no son necesarios para el procedimiento anterior:

```text
docker compose up --build
```

## Estructura principal

```text
login-signup-alumnos/
├── assets/logo.png
├── docs/
├── navigation/Navigation.js
├── screens/
│   ├── Home.js
│   ├── Login.js
│   └── SignUp.js
├── src/config/firebaseConfig.js
├── .env.example
├── App.js
├── package-lock.json
└── package.json
```

Si falta `.env` o algún valor, la aplicación muestra un aviso en lugar de iniciar Firebase con una configuración incompleta.
