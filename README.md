# AWS Rekognition - Analizador de Imágenes

Un proyecto académico sencillo para demostrar la integración de servicios de Inteligencia Artificial (Visión por Computadora) utilizando la API de **AWS Rekognition** con Node.js y Express.

Este proyecto está diseñado con fines educativos e implementa un "mock" (simulación) del SDK de AWS, lo que permite realizar pruebas locales de detección de etiquetas (objetos, personas, etc.) sin consumir recursos reales ni generar costos en la nube.

## Características

- **Subida de imágenes**: Manejo de archivos multipart usando `multer`.
- **Detección de Etiquetas**: Simulación de la respuesta de AWS Rekognition (`DetectLabelsCommand`).
- **Interfaz**: Frontend limpio y responsivo escrito en HTML, CSS (Vanilla) y JavaScript puro.
- **Entorno Seguro**: Configuración de variables de entorno mediante `.env`.

## Tecnologías Utilizadas

- **Backend:** Node.js, Express.js
- **AWS SDK:** `@aws-sdk/client-rekognition` (v3)
- **Testing/Mocking:** `aws-sdk-client-mock`
- **Frontend:** Vanilla JS, HTML5, CSS3.

## Requisitos Previos

Antes de ejecutar este proyecto, asegúrate de tener instalado:
- [Node.js](https://nodejs.org/) (Versión 18+ recomendada)
- NPM (Incluido con Node.js)

## Instalación y Configuración

1. **Clonar o descargar** el repositorio.
2. Navegar al directorio del proyecto e instalar las dependencias:
   ```bash
   npm install
   ```
3. **Configurar las variables de entorno**:
   Copia el archivo `.env-example` y renómbralo a `.env`.
   ```bash
   cp .env-example .env
   ```
   *Nota: Dado que el proyecto utiliza un mock de AWS, no es obligatorio poner credenciales reales en el `.env` para que la aplicación local funcione.*

## Cómo ejecutar el proyecto

Para iniciar el servidor local, ejecuta el siguiente comando:

```bash
node server.js
```

La aplicación estará disponible en tu navegador en: [http://localhost:3000](http://localhost:3000)

## ¿Cómo funciona el Mock de AWS?

Para evitar costos durante el desarrollo académico, el archivo `server.js` intercepta la llamada a la clase `RekognitionClient` utilizando la librería `aws-sdk-client-mock`. 

Cuando envías una imagen, el backend *no* hace una petición real a Amazon, sino que devuelve inmediatamente el siguiente JSON estático definido en el código:

```json
[
  { "Name": "Hombre", "Confidence": 99.4 },
  { "Name": "Niño", "Confidence": 95.2 },
  { "Name": "Perro", "Confidence": 70.1 },
  { "Name": "Mujer", "Confidence": 98.4 }
]
```
Si en el futuro deseas conectarlo a tu cuenta real de AWS, simplemente debes comentar o eliminar la sección de "mockup" en `server.js` y configurar tus llaves `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` reales en el archivo `.env`.
