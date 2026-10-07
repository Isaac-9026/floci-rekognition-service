require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");

//Cliente que gestiona servicio AWS
const {
    RekognitionClient,
    DetectLabelsCommand,
} = require("@aws-sdk/client-rekognition");

//Opcional (Debe de considerarse cuando se realice pruebas con FLOCI)
//Respuesta prueba ...

const app = express();
const port = process.env.PORT || 3000;

//Iniciar el servicio reconocimiento
const rekognitionClient = new RekognitionClient({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: "http://localhost:4566",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

//Configuración multer (upload archivos imagen)
const upload = multer({ storage: multer.memoryStorage() });

//Servicios archivos .html
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

//Ruta para procesar la imágen
//VERBO => RUTA => ACCION => FUNCION ASINCRONA(SOLICITUD - RESPUESTA)
app.post("/api/analizar", upload.single("imagen"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se adjunto una imágen válida' })
        }

        //El buffer de la imágen subida
        const imageBuffer = req.file.buffer


        //Configurar el comando para detectar etiquetas (ML Machine Learning / Simulación)
        const params = {
            Image: { Bytes: imageBuffer },
            MaxLabels: 10,
            MinConfidence: 75
        }

        //Instanciar el comando de deteción
        const command = new DetectLabelsCommand(params)
        const response = await rekognitionClient.send(command)

        //Enviar la respuesta al frontend como JSON
        res.json({
            success: true,
            labels: response.Labels
        })

    } catch (error) {
        console.log(`Error en el servicio AWS:`, error);
        res.status(500).json({
            error: "No se pudo concretar el análisis en AWS Rekognition",
            details: error.messagge,
            code: error.name,
        });
    }
});

//Iniciamos el servidor web
app.listen(port, () => {
    console.log(`Servidor ejecutándose en http://localhost:${port}`);
});
