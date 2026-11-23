import * as XLSX from "xlsx";
import type {
  Client,
  ClientStatus,
  ColumnMapping,
} from "../api/erp";

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

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

export async function parseXlsxFile(file: File): Promise<ParsedSheetData> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Seuls les classeurs Excel au format .xlsx sont acceptés.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Le fichier dépasse la taille maximale autorisée de 5 Mo.");
  }

  let workbook: XLSX.WorkBook;
  try {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  } catch {
    throw new Error(
      "Impossible de lire ce fichier. Assurez-vous qu'il s'agit bien d'un classeur Excel enregistré au format .xlsx (non protégé par mot de passe).",
    );
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Le classeur Excel ne contient aucune feuille.");
  }
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error("Le classeur Excel ne contient aucune feuille lisible.");
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (matrix.length === 0) {
    throw new Error(
      "La première ligne du fichier Excel doit contenir les en-têtes de colonnes (ex. Nom, Email, Téléphone, Entreprise, Statut).",
    );
  }

  const rawHeaderRow = matrix[0] ?? [];
  const headers: string[] = [];
  const colIndexes: number[] = [];

  for (let colIdx = 0; colIdx < rawHeaderRow.length; colIdx++) {
    const rawHeader = cellToString(rawHeaderRow[colIdx]);
    if (rawHeader) {
      const uniqueHeader = headers.includes(rawHeader)
        ? `${rawHeader} (${colIdx + 1})`
        : rawHeader;
      headers.push(uniqueHeader);
      colIndexes.push(colIdx);
    }
  }

  if (headers.length === 0) {
    throw new Error(
      "La première ligne du fichier Excel doit contenir les en-têtes de colonnes (ex. Nom, Email, Téléphone, Entreprise, Statut).",
    );
  }

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    if (rows.length >= MAX_IMPORT_ROWS) {
      throw new Error(
        `Le fichier dépasse la limite de ${MAX_IMPORT_ROWS} lignes par import.`,
      );
    }

    const rawRow = matrix[r] ?? [];
    const record: Record<string, string> = {};
    let hasAnyValue = false;

    for (let i = 0; i < headers.length; i++) {
      const val = cellToString(rawRow[colIndexes[i]]);
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
    sheetName: firstSheetName || "Feuille 1",
    headers,
    rows,
  };
}

export function buildClientTemplateXlsxBlob(): Blob {
  const rows = [
    ["Nom", "Email", "Téléphone", "Entreprise", "Statut", "Notes"],
    [
      "Claire Bernard",
      "claire@studio-b.fr",
      "+33 6 12 34 56 78",
      "Studio B",
      "Actif",
      "Contact principal",
    ],
    [
      "Marc Lefèvre",
      "marc@atelier-nord.fr",
      "+33 6 98 76 54 32",
      "Atelier Nord",
      "Prospect",
      "Devis demandé",
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 28 },
    { wch: 18 },
    { wch: 24 },
    { wch: 14 },
    { wch: 32 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");
  const buffer = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer;

  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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
  existingClients: Client[],
): ValidatedImportRow[] {
  const existingByEmail = new Map<string, Client>();
  const existingByName = new Map<string, Client>();

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

    const name = (mapping.name ? rawRow[mapping.name] ?? "" : "").trim().slice(0, 160);
    const email = (mapping.email ? rawRow[mapping.email] ?? "" : "")
      .trim()
      .toLowerCase()
      .slice(0, 200);
    const phone = (mapping.phone ? rawRow[mapping.phone] ?? "" : "")
      .trim()
      .slice(0, 60);
    const companyName = (
      mapping.companyName ? rawRow[mapping.companyName] ?? "" : ""
    )
      .trim()
      .slice(0, 160);
    const rawStatus = (mapping.status ? rawRow[mapping.status] ?? "" : "").trim();
    const notes = (mapping.notes ? rawRow[mapping.notes] ?? "" : "")
      .trim()
      .slice(0, 2000);

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
    if (errors.length > 0) {
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

export function buildClientsCsv(clients: Client[]): string {
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
