import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

let client: Client;

beforeAll(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(b);
});

async function call(name: string, args: Record<string, unknown>) {
  const res = await client.callTool({ name, arguments: args });
  const content = res.content as { type: string; text: string }[];
  const text = content[0]!.text;
  return { isError: res.isError === true, text, data: res.isError ? undefined : JSON.parse(text) };
}

describe("server", () => {
  it("lists its tools, all read-only", async () => {
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual([
      "get_commune",
      "get_wilaya",
      "locate_point",
      "search_communes",
      "validate",
      "wilaya_changes",
    ]);
    for (const t of tools) expect(t.annotations?.readOnlyHint, t.name).toBe(true);
  });

  it("searches communes", async () => {
    const { data } = await call("search_communes", { query: "bou saada", limit: 3 });
    expect(data[0]).toMatchObject({ code: "2820", wilaya: { code: "68" }, score: 0 });
  });

  it("searches within a wilaya given by name", async () => {
    const { data } = await call("search_communes", { query: "El Marsa", wilaya: "Alger" });
    expect(data.map((r: { code: string }) => r.code)).toEqual(["1640"]);
    expect((await call("search_communes", { query: "x", wilaya: "Atlantis" })).isError).toBe(true);
  });

  it("gets a wilaya with its communes", async () => {
    const { data } = await call("get_wilaya", { wilaya: "Bou Saada" });
    expect(data).toMatchObject({ code: "68", createdBy: "loi 26-06", communeCount: 23 });
    expect((await call("get_wilaya", { wilaya: "70" })).isError).toBe(true);
  });

  it("gets a commune under the three maps", async () => {
    const { data } = await call("get_commune", { code: "2820" });
    expect(data).toMatchObject({ wilaya: { code: "68" }, wilaya58: { code: "28" }, wilaya48: { code: "28" } });
    expect((await call("get_commune", { code: "9999" })).isError).toBe(true);
  });

  it("lists the 2026 and 2019 moves", async () => {
    expect((await call("wilaya_changes", {})).data.count).toBe(108);
    const to68 = await call("wilaya_changes", { wilaya: "68" });
    expect(to68.data.count).toBe(23);
    expect((await call("wilaya_changes", { reform: 2019 })).data.reform).toBe(2019);
  });

  it("locates a GPS point", async () => {
    const { data } = await call("locate_point", { lat: 35.6971, lon: -0.6308 });
    expect(data).toMatchObject({ commune: { code: "3101" }, wilaya: { code: "31" } });
    expect((await call("locate_point", { lat: 48.85, lon: 2.35 })).isError).toBe(true);
  });

  it("validates formats", async () => {
    expect((await call("validate", { kind: "phone", value: "0661 23 45 67" })).data).toMatchObject({
      valid: true,
      operator: "Mobilis",
    });
    expect((await call("validate", { kind: "rip", value: "007 99999 0000000200 91" })).data.valid).toBe(true);
    expect((await call("validate", { kind: "ccp", value: "200", key: "13" })).data.reason).toBe("key");
    expect((await call("validate", { kind: "commune", value: "El Marsa" })).data.reason).toBe("ambiguous");
    expect((await call("validate", { kind: "commune", value: "El Marsa", wilaya: "16" })).data.valid).toBe(true);
    expect((await call("validate", { kind: "postal", value: "16024" })).data).toMatchObject({ valid: true, wilaya: "16" });
    expect((await call("validate", { kind: "rc", value: "01B 0015609-16/00" })).data.canonical).toBe("16/00-0015609 B 01");
    expect((await call("validate", { kind: "nif", value: "00021600180833716001" })).data.establishment).toBe("16001");
  });

  it("rejects bad arguments", async () => {
    const res = await client.callTool({ name: "locate_point", arguments: { lat: 120, lon: 3 } });
    expect(res.isError).toBe(true);
  });
});
