import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import {
  buildClientTemplateXlsx,
  parseXlsxBuffer,
  suggestMapping,
} from "./importExport.js";

export const excelRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxImportFileBytes,
    files: 1,
  },
});

excelRouter.get("/template", async (_req, res) => {
  const buffer = await buildClientTemplateXlsx();
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="qone-modele-clients.xlsx"',
  );
  res.send(buffer);
});

excelRouter.post(
  "/parse",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({
            error: "Le fichier dépasse la taille maximale autorisée de 5 Mo.",
          });
          return;
        }
        res.status(400).json({ error: "Erreur lors du téléversement du fichier." });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Veuillez sélectionner un fichier .xlsx." });
      return;
    }

    if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
      res.status(400).json({
        error: "Seuls les classeurs Excel au format .xlsx sont acceptés.",
      });
      return;
    }

    try {
      const parsed = await parseXlsxBuffer(file.buffer);
      res.json({
        sheetName: parsed.sheetName,
        headers: parsed.headers,
        suggestedMapping: suggestMapping(parsed.headers),
        totalRows: parsed.rows.length,
        rows: parsed.rows,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de lire ce fichier Excel.";
      res.status(400).json({ error: message });
    }
  },
);
