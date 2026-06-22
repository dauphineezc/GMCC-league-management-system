/** @jest-environment node */

jest.mock("@vercel/kv", () => ({
  kv: {
    smembers: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    sadd: jest.fn(),
  },
}));

jest.mock("@/lib/firebaseAdmin", () => ({
  adminAuth: {
    listUsers: jest.fn(),
    getUserByEmail: jest.fn(),
  },
}));

import { kv } from "@vercel/kv";
import { readAdminLeagueIds } from "@/lib/adminLeaguesMigration";

const mockKv = kv as jest.Mocked<typeof kv>;

describe("readAdminLeagueIds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns SET members when key is a set", async () => {
    mockKv.smembers.mockResolvedValue(["league-a", "league-b"]);
    const ids = await readAdminLeagueIds("admin:uid1:leagues");
    expect(ids).toEqual(["league-a", "league-b"]);
    expect(mockKv.get).not.toHaveBeenCalled();
  });

  it("parses JSON array strings", async () => {
    mockKv.smembers.mockRejectedValue(new Error("WRONGTYPE"));
    mockKv.get.mockResolvedValue('["x","y"]');
    const ids = await readAdminLeagueIds("admin:uid1:leagues");
    expect(ids).toEqual(["x", "y"]);
  });

  it("parses a single legacy league id string", async () => {
    mockKv.smembers.mockResolvedValue([]);
    mockKv.get.mockResolvedValue("my-league");
    const ids = await readAdminLeagueIds("admin:uid1:leagues");
    expect(ids).toEqual(["my-league"]);
  });
});
