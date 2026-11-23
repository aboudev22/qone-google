import ExcelJS from "exceljs";
import type { ClientRecord, ClientStatus } from "../../shared/types.js";

export type ClientFieldKey =
  | "name"
  | "email"
  | "phone"
  | "companyName"
  | "status"
  | "notes";

export type ColumnMapping = Partial<Record<ClientFieldKey, string>>;

export type DuplicatePolicy = "skip" | "update" | "error";

export interface ParsedSheetData {
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
}

export interface ValidatedImportRow {
  rowNumber: number;
  status: "valid" | "duplicate" | "invalid";
  duplicateMatchId?: string;
  errors: string[];
  data: {
    name: string;
    email: string;
    phone: string;
    companyName: string;
    status: ClientStatus;
    notes: string;
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IMPORT_ROWS = 5000;

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("")
        .trim();
    }
    if ("result" in value && value.result !== undefined) {
      return cellToString(value.result as ExcelJS.CellValue);
    }
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.hyperlink.replace(/^mailto:/i, "").trim();
    }
  }
  return String(value).trim();
}

export async function parseXlsxBuffer(buffer: Buffer): Promise<ParsedSheetData> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new Error(
      "Impossible de lire ce fichier. Assurez-vous qu'il s'agit bien d'un classeur Excel enregistré au format .xlsx (non protégé par mot de passe).",
    );
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Le classeur Excel ne contient aucune feuille.");
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  const colIndexes: number[] = [];

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const rawHeader = cellToString(cell.value);
    if (rawHeader) {
      const uniqueHeader = headers.includes(rawHeader)
        ? `${rawHeader} (${colNumber})`
        : rawHeader;
      headers.push(uniqueHeader);
      colIndexes.push(colNumber);
    }
  });

  if (headers.length === 0) {
    throw new Error(
      "La première ligne du fichier Excel doit contenir les en-têtes de colonnes (ex. Nom, Email, Téléphone, Entreprise, Statut).",
    );
  }

  const rows: Record<string, string>[] = [];
  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
    if (rows.length >= MAX_IMPORT_ROWS) {
      throw new Error(
        `Le fichier dépasse la limite de ${MAX_IMPORT_ROWS} lignes par import.`,
      );
    }

    const row = worksheet.getRow(rowNum);
    const record: Record<string, string> = {};
    let hasAnyValue = false;

    for (let i = 0; i < headers.length; i++) {
      const val = cellToString(row.getCell(colIndexes[i]).value);
      record[headers[i]] = val;
      if (val !== "") hasAnyValue = true;
    }

    if (hasAnyValue) {
      rows.push(record);
    }
  }

  if (rows.length === 0) {
    throw new Error("Aucune ligne de données détectée sous les en-têtes.");
  }

  return {
    sheetName: worksheet.name || "Feuille 1",
    headers,
    rows,
  };
}

export async function buildClientTemplateXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Clients");

  sheet.columns = [
    { header: "Nom", key: "name", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Téléphone", key: "phone", width: 18 },
    { header: "Entreprise", key: "companyName", width: 24 },
    { header: "Statut", key: "status", width: 14 },
    { header: "Notes", key: "notes", width: 32 },
  ];

  sheet.addRow({
    name: "Claire Bernard",
    email: "claire@studio-b.fr",
    phone: "+33 6 12 34 56 78",
    companyName: "Studio B",
    status: "Actif",
    notes: "Contact principal",
  });
  sheet.addRow({
    name: "Marc Lefèvre",
    email: "marc@atelier-nord.fr",
    phone: "+33 6 98 76 54 32",
    companyName: "Atelier Nord",
    status: "Prospect",
    notes: "Devis demandé",
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  for (const header of headers) {
    const h = normalize(header);
    if (!mapping.name && /^(nom|name|client|contact|full.?name|nom complet)$/.test(h)) {
      mapping.name = header;
    } else if (!mapping.email && /^(email|e-mail|mail|courriel|adresse email)$/.test(h)) {
      mapping.email = header;
    } else if (!mapping.phone && /^(telephone|tel|phone|mobile|gsm|numero)$/.test(h)) {
      mapping.phone = header;
    } else if (
      !mapping.companyName &&
      /^(entreprise|societe|company|organisation|organization|raison sociale)$/.test(h)
    ) {
      mapping.companyName = header;
    } else if (!mapping.status && /^(statut|status|etat|type)$/.test(h)) {
      mapping.status = header;
    } else if (!mapping.notes && /^(notes|note|commentaire|remarque|description)$/.test(h)) {
      mapping.notes = header;
    }
  }

  return mapping;
}

function normalizeClientStatus(raw: string): ClientStatus | null {
  const cleaned = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!cleaned || cleaned === "actif" || cleaned === "active") return "active";
  if (cleaned === "prospect" || cleaned === "lead") return "prospect";
  if (cleaned === "inactif" || cleaned === "inactive" || cleaned === "archive") {
    return "inactive";
  }
  return null;
}

export function validateImportRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  existingClients: ClientRecord[],
): ValidatedImportRow[] {
  const existingByEmail = new Map<string, ClientRecord>();
  const existingByName = new Map<string, ClientRecord>();

  for (const client of existingClients) {
    if (client.email) {
      existingByEmail.set(client.email.toLowerCase(), client);
    }
    existingByName.set(
      `${client.name.toLowerCase()}::${client.companyName.toLowerCase()}`,
      client,
    );
  }

  const seenEmailsInFile = new Set<string>();
  const seenNamesInFile = new Set<string>();

  return rows.map((rawRow, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];

    const name = mapping.name ? (rawRow[mapping.name] ?? "").trim() : "";
    const email = mapping.email
      ? (rawRow[mapping.email] ?? "").trim().toLowerCase()
      : "";
    const phone = mapping.phone ? (rawRow[mapping.phone] ?? "").trim() : "";
    const companyName = mapping.companyName
      ? (rawRow[mapping.companyName] ?? "").trim()
      : "";
    const rawStatus = mapping.status ? (rawRow[mapping.status] ?? "").trim() : "";
    const notes = mapping.notes ? (rawRow[mapping.notes] ?? "").trim() : "";

    if (!name) {
      errors.push("Nom du client obligatoire.");
    }

    if (email && !EMAIL_RE.test(email)) {
      errors.push(`Adresse email invalide (${email}).`);
    }

    const normalizedStatus = normalizeClientStatus(rawStatus);
    if (!normalizedStatus) {
      errors.push(
        `Statut invalide ("${rawStatus}"). Valeurs acceptées : Actif, Prospect, Inactif.`,
      );
    }

    let duplicateMatchId: string | undefined;
    let isDuplicate = false;

    if (errors.length === 0) {
      if (email) {
        const existing = existingByEmail.get(email);
        if (existing) {
          isDuplicate = true;
          duplicateMatchId = existing.id;
        } else if (seenEmailsInFile.has(email)) {
          isDuplicate = true;
          errors.push(`Email en doublon dans le fichier (${email}).`);
        }
        seenEmailsInFile.add(email);
      } else {
        const nameKey = `${name.toLowerCase()}::${companyName.toLowerCase()}`;
        const existing = existingByName.get(nameKey);
        if (existing) {
          isDuplicate = true;
          duplicateMatchId = existing.id;
        } else if (seenNamesInFile.has(nameKey)) {
          isDuplicate = true;
          errors.push(`Client en doublon dans le fichier (${name}).`);
        }
        seenNamesInFile.add(nameKey);
      }
    }

    let rowStatus: "valid" | "duplicate" | "invalid" = "valid";
    if (errors.length > 0 && !isDuplicate) {
      rowStatus = "invalid";
    } else if (isDuplicate && errors.length > 0) {
      rowStatus = "invalid";
    } else if (isDuplicate) {
      rowStatus = "duplicate";
    }

    return {
      rowNumber,
      status: rowStatus,
      duplicateMatchId,
      errors,
      data: {
        name,
        email,
        phone,
        companyName,
        status: normalizedStatus ?? "active",
        notes,
      },
    };
  });
}

function sanitizeCsvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  const escaped = safe.replace(/"/g, '""');
  if (/[",\r\n]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
}

const STATUS_LABEL: Record<ClientStatus, string> = {
  active: "Actif",
  prospect: "Prospect",
  inactive: "Inactif",
};

export function buildClientsCsv(clients: ClientRecord[]): string {
  const headers = [
    "Nom",
    "Email",
    "Téléphone",
    "Entreprise",
    "Statut",
    "Notes",
    "Créé le",
  ];

  const lines = [headers.map(sanitizeCsvCell).join(",")];
  for (const client of clients) {
    lines.push(
      [
        client.name,
        client.email,
        client.phone,
        client.companyName,
        STATUS_LABEL[client.status] ?? client.status,
        client.notes,
        client.createdAt.slice(0, 10),
      ]
        .map(sanitizeCsvCell)
        .join(","),
    );
  }

  return `\uFEFF${lines.join("\r\n")}`;
}
