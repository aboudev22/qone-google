import type {
  Client,
  ClientStatus,
  ColumnMapping,
} from "../api/erp";

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
