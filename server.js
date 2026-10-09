require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");

//Cliente que gestiona servicio AWS
const {
  RekognitionClient,
  DetectLabelsCommand,
} = require("@aws-sdk/client-rekognition");

//Cliente que gestiona AWS Textract
const {
  TextractClient,
  DetectDocumentTextCommand,
} = require("@aws-sdk/client-textract");

//Validación del PDF y su número de páginas
const { PDFDocument } = require("pdf-lib");

//Opcional (Debe de considerarse cuando se realice pruebas con FLOCI)
//Configuracion del mockup (dato de prueba personalizado)
const { mockClient } = require("aws-sdk-client-mock");
const rekognitionMock = mockClient(RekognitionClient);

//Definir la respuesta personalizada
//Cliente detecte evento, devolverá...
rekognitionMock.on(DetectLabelsCommand).resolves({
  Labels: [
    {Name: 'Hombre', Confidence: 99.4},
    {Name: 'Niño', Confidence: 95.2},
    {Name: 'Perro', Confidence: 70.1},
    {Name: 'Mujer', Confidence: 98.4}
  ]
})
//fin mockup

//Mock independiente de Textract.
//Intercepta send() para evitar llamadas reales a AWS.
const textractMock = mockClient(TextractClient);

textractMock.on(DetectDocumentTextCommand).resolves({
  DocumentMetadata: {
    Pages: 1,
  },
  Blocks: [
    {
      BlockType: "PAGE",
      Id: "page-1",
      Page: 1,
      Relationships: [
        {
          Type: "CHILD",
          Ids: ["line-1"],
        },
      ],
    },
    {
      BlockType: "LINE",
      Id: "line-1",
      Page: 1,
      Text: "flocy",
      Confidence: 99.9,
      Relationships: [
        {
          Type: "CHILD",
          Ids: ["word-1"],
        },
      ],
    },
    {
      BlockType: "WORD",
      Id: "word-1",
      Page: 1,
      Text: "flocy",
      TextType: "PRINTED",
      Confidence: 99.9,
    },
  ],
});

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

//Iniciar Textract en modo de prueba.
//El mock intercepta las solicitudes antes de acceder a la red.
const textractClient = new TextractClient({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: "http://localhost:4566",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

//Configuración multer (upload archivos imagen)
const upload = multer({ storage: multer.memoryStorage() });

//Configuración independiente para PDF
const MAX_PDF_SIZE = 5 * 1024 * 1024;

const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PDF_SIZE,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const tieneExtensionPdf =
      path.extname(file.originalname).toLowerCase() === ".pdf";
    const tieneMimePdf = file.mimetype === "application/pdf";

    if (!tieneExtensionPdf || !tieneMimePdf) {
      const error = new Error("Solo se permiten archivos PDF.");
      error.code = "INVALID_PDF";
      return callback(error);
    }

    callback(null, true);
  },
});

const recibirPdf = uploadPdf.single("documento");

//Servicios archivos .html
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

//Ruta para procesar la imágen
//VERBO => RUTA => ACCION => FUNCION ASINCRONA(SOLICITUD - RESPUESTA)
app.post("/api/analizar", upload.single("imagen"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se adjunto una imágen válida" });
    }

    //El buffer de la imágen subida
    const imageBuffer = req.file.buffer;

    //Configurar el comando para detectar etiquetas (ML Machine Learning / Simulación)
    const params = {
      Image: { Bytes: imageBuffer },
      MaxLabels: 10,
      MinConfidence: 75,
    };

    //Instanciar el comando de deteción
    const command = new DetectLabelsCommand(params);
    const response = await rekognitionClient.send(command);

    //Enviar la respuesta al frontend como JSON
    res.json({
      success: true,
      labels: response.Labels,
    });
  } catch (error) {
    console.log(`Error en el servicio AWS:`, error);
    res.status(500).json({
      error: "No se pudo concretar el análisis en AWS Rekognition",
      details: error.messagge,
      code: error.name,
    });
  }
});

//Ruta independiente para detectar texto en PDF
app.post("/api/detect-text", (req, res) => {
  recibirPdf(req, res, async (errorUpload) => {
    //Los errores de Multer se devuelven como JSON.
    if (errorUpload) {
      if (errorUpload.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          error: "El PDF debe pesar menos de 5 MB.",
        });
      }

      return res.status(400).json({
        success: false,
        error:
          errorUpload.code === "INVALID_PDF"
            ? errorUpload.message
            : "Adjunta un único PDF en el campo documento.",
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No se adjuntó un archivo PDF.",
        });
      }

      //Comparación explícita para exigir un tamaño
      //estrictamente inferior al límite.
      if (req.file.size >= MAX_PDF_SIZE) {
        return res.status(413).json({
          success: false,
          error: "El PDF debe pesar menos de 5 MB.",
        });
      }

      const pdfBuffer = req.file.buffer;

      //No confiar únicamente en la extensión y el MIME.
      const tieneCabeceraPdf =
        pdfBuffer.subarray(0, 5).toString("ascii") === "%PDF-";

      if (!tieneCabeceraPdf) {
        return res.status(400).json({
          success: false,
          error: "El archivo no contiene una cabecera PDF válida.",
        });
      }

      let pdfDocument;

      try {
        //No se ignora el cifrado: los PDF cifrados se rechazan.
        pdfDocument = await PDFDocument.load(pdfBuffer, {
          ignoreEncryption: false,
          throwOnInvalidObject: true,
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: "El PDF no es válido, está dañado o está cifrado.",
        });
      }

      if (pdfDocument.getPageCount() !== 1) {
        return res.status(400).json({
          success: false,
          error: "Solo se permiten archivos PDF de una página.",
        });
      }

      const command = new DetectDocumentTextCommand({
        Document: {
          Bytes: pdfBuffer,
        },
      });

      const response = await textractClient.send(command);

      //Enviar a ui
      return res.json({
        success: true,
        DocumentMetadata: response.DocumentMetadata,
        Blocks: response.Blocks,
      });
    } catch (error) {
      console.error("Error en el servicio AWS Textract:", error);

      return res.status(500).json({
        success: false,
        error: "No se pudo detectar el texto con AWS Textract.",
      });
    }
  });
});

//Iniciamos el servidor web
app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
});
