import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { changes, commune, communes, search, wilaya, type Commune } from "@syscli/algeria";
import { communeAt, wilayaAt } from "@syscli/algeria/geo";
import { ccp, phone, plate, rib, rip } from "@syscli/dz-format";
import { commune as checkCommune, wilaya as checkWilaya } from "@syscli/dz-format/place";
import { z } from "zod";

export const VERSION = "0.1.0";

function json(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function notFound(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function wilayaName(code: string): string | undefined {
  return wilaya(code)?.nameFr;
}

function describeCommune(c: Commune) {
  return {
    code: c.code,
    nameFr: c.nameFr,
    nameAr: c.nameAr,
    wilaya: { code: c.wilayaCode, nameFr: wilayaName(c.wilayaCode) },
    wilaya58: { code: c.wilayaCode58, nameFr: wilayaName(c.wilayaCode58) },
    wilaya48: { code: c.wilayaCode48, nameFr: wilayaName(c.wilayaCode48) },
    daira1991: c.daira1991,
    otherNames: c.aliases,
  };
}

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

export function createServer(): McpServer {
  const server = new McpServer({ name: "algeria", version: VERSION });

  server.registerTool(
    "search_communes",
    {
      title: "Search communes",
      description:
        "Find Algerian communes by name, in French or Arabic. Handles accents, articles, transliteration " +
        "variants (Djelfa/Jelfa, Beni/Bni), old official names and small typos. Returns the commune, its " +
        "current wilaya (69-wilaya map, 2026) and a score where 0 is an exact match.",
      inputSchema: {
        query: z.string().min(1).describe("Commune name, e.g. 'bou saada' or 'Bains Romains'"),
        wilaya: z.string().optional().describe("Only search in this wilaya, by code ('16') or name ('Alger')"),
        limit: z.number().int().min(1).max(50).optional().describe("Maximum results, default 10"),
      },
      annotations: READ_ONLY,
    },
    ({ query, wilaya: w, limit }) => {
      let only: string | undefined;
      if (w !== undefined) {
        const found = wilaya(w);
        if (!found) return notFound(`No wilaya matches "${w}".`);
        only = found.code;
      }
      const results = search(query, { limit: limit ?? 10, ...(only ? { wilaya: only } : {}) });
      return json(
        results.map(r => ({
          code: r.commune.code,
          nameFr: r.commune.nameFr,
          nameAr: r.commune.nameAr,
          wilaya: { code: r.wilaya.code, nameFr: r.wilaya.nameFr },
          score: r.score,
        })),
      );
    },
  );

  server.registerTool(
    "get_wilaya",
    {
      title: "Get a wilaya",
      description:
        "One of Algeria's 69 wilayas by code ('05', also the vehicle plate number) or by name in French or " +
        "Arabic, with the law that created it and the list of its communes.",
      inputSchema: {
        wilaya: z.string().min(1).describe("Code ('68') or name ('Bou Saada')"),
      },
      annotations: READ_ONLY,
    },
    ({ wilaya: query }) => {
      const w = wilaya(query);
      if (!w) return notFound(`No wilaya matches "${query}". Codes run from 01 to 69.`);
      const list = communes(w.code).map(c => ({ code: c.code, nameFr: c.nameFr, nameAr: c.nameAr }));
      return json({ ...w, communeCount: list.length, communes: list });
    },
  );

  server.registerTool(
    "get_commune",
    {
      title: "Get a commune",
      description:
        "A commune by its four-digit ONS code, with its wilaya under the 2026 (69), 2019 (58) and 1984 (48) " +
        "maps, its 1991 daira and its other names.",
      inputSchema: {
        code: z.string().regex(/^\d{1,4}$/).describe("ONS code, e.g. '1601'"),
      },
      annotations: READ_ONLY,
    },
    ({ code }) => {
      const c = commune(code);
      return c ? json(describeCommune(c)) : notFound(`No commune has the ONS code ${code}.`);
    },
  );

  server.registerTool(
    "wilaya_changes",
    {
      title: "Communes that changed wilaya",
      description:
        "Communes moved to another wilaya by a reform: 2026 (loi 26-06, 58 to 69 wilayas) or 2019 " +
        "(loi 19-12, 48 to 58 wilayas). Optionally only those moved from or to one wilaya.",
      inputSchema: {
        reform: z.union([z.literal(2019), z.literal(2026)]).optional().describe("2026 (default) or 2019"),
        wilaya: z.string().optional().describe("Only moves from or to this wilaya, by code or name"),
      },
      annotations: READ_ONLY,
    },
    ({ reform, wilaya: w }) => {
      let only: string | undefined;
      if (w !== undefined) {
        const found = wilaya(w);
        if (!found) return notFound(`No wilaya matches "${w}".`);
        only = found.code;
      }
      const moves = changes(reform ?? 2026)
        .filter(m => !only || m.from === only || m.to === only)
        .map(m => ({
          code: m.commune.code,
          nameFr: m.commune.nameFr,
          nameAr: m.commune.nameAr,
          from: { code: m.from, nameFr: wilayaName(m.from) },
          to: { code: m.to, nameFr: wilayaName(m.to) },
        }));
      return json({ reform: reform ?? 2026, count: moves.length, communes: moves });
    },
  );

  server.registerTool(
    "locate_point",
    {
      title: "Which commune is this point in",
      description:
        "The commune and wilaya that contain a GPS point. Boundaries are accurate to about 100 m and come " +
        "from OpenStreetMap (CC BY-SA 2.0). Returns nothing for points outside Algeria.",
      inputSchema: {
        lat: z.number().min(-90).max(90).describe("Latitude in degrees, e.g. 36.75"),
        lon: z.number().min(-180).max(180).describe("Longitude in degrees, e.g. 3.06"),
      },
      annotations: READ_ONLY,
    },
    ({ lat, lon }) => {
      const c = communeAt(lat, lon);
      const w = c ? wilaya(c.wilayaCode) : wilayaAt(lat, lon);
      if (!w) return notFound(`The point ${lat}, ${lon} is not in Algeria.`);
      return json({
        commune: c ? describeCommune(c) : null,
        wilaya: { code: w.code, nameFr: w.nameFr, nameAr: w.nameAr },
        attribution: "(c) OpenStreetMap contributors",
      });
    },
  );

  server.registerTool(
    "validate",
    {
      title: "Check an Algerian format",
      description:
        "Checks that a value is well formed and returns its parts, or the reason it is not. Kinds: phone " +
        "(mobile, landline, VoIP), rib (any bank, 20 digits), rip (Algerie Poste RIP), ccp (account number, " +
        "with 'key' to check), plate (vehicle plate), wilaya, commune (with 'wilaya' to pick among shared " +
        "names). Well formed does not mean the account or line exists.",
      inputSchema: {
        kind: z.enum(["phone", "rib", "rip", "ccp", "plate", "wilaya", "commune"]),
        value: z.string().min(1),
        key: z.string().optional().describe("For ccp: the two-digit key to check"),
        wilaya: z.string().optional().describe("For commune: the wilaya, by code or name"),
      },
      annotations: READ_ONLY,
    },
    ({ kind, value, key, wilaya: w }) => {
      switch (kind) {
        case "phone":
          return json(phone(value));
        case "rib":
          return json(rib(value));
        case "rip":
          return json(rip(value));
        case "ccp":
          return json(ccp(value, key));
        case "plate":
          return json(plate(value));
        case "wilaya":
          return json(checkWilaya(value));
        case "commune":
          return json(checkCommune(value, w === undefined ? {} : { wilaya: w }));
      }
    },
  );

  return server;
}
