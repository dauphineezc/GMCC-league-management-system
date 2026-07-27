/** @jest-environment node */

jest.mock("@/db/index", () => ({ db: {} }));

jest.mock("@/lib/firebaseAdmin", () => ({
  adminAuth: {
    getUserByEmail: jest.fn(),
    listUsers: jest.fn(),
  },
}));

jest.mock("@/lib/repositories/leaguesRepo", () => ({
  listLeagueRefsForAdminUser: jest.fn(),
  syncLeagueAdminsFromRefs: jest.fn(),
  listLeagueSlugs: jest.fn(),
  readLeagueDocByRef: jest.fn(),
  setLeaguePrimaryAdmin: jest.fn(),
}));

import { adminAuth } from "@/lib/firebaseAdmin";
import { listLeagueRefsForAdminUser } from "@/lib/repositories/leaguesRepo";
import { readAdminLeagueIds } from "@/lib/adminLeaguesMigration";

const mockListLeagueRefs = listLeagueRefsForAdminUser as jest.MockedFunction<
  typeof listLeagueRefsForAdminUser
>;
const mockGetUserByEmail = adminAuth.getUserByEmail as jest.MockedFunction<
  typeof adminAuth.getUserByEmail
>;

describe("readAdminLeagueIds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns league slugs for a uid key", async () => {
    mockListLeagueRefs.mockResolvedValue(["4v4a", "5v5"]);
    const ids = await readAdminLeagueIds("admin:uid1:leagues");
    expect(ids).toEqual(["4v4a", "5v5"]);
    expect(mockListLeagueRefs).toHaveBeenCalledWith("uid1");
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
  });

  it("resolves email keys via Firebase before reading Postgres", async () => {
    mockGetUserByEmail.mockResolvedValue({ uid: "uid-from-email" } as any);
    mockListLeagueRefs.mockResolvedValue(["4v4a"]);
    const ids = await readAdminLeagueIds("admin:admin@example.com:leagues");
    expect(ids).toEqual(["4v4a"]);
    expect(mockGetUserByEmail).toHaveBeenCalledWith("admin@example.com");
    expect(mockListLeagueRefs).toHaveBeenCalledWith("uid-from-email");
  });

  it("returns empty when email does not resolve", async () => {
    mockGetUserByEmail.mockRejectedValue(new Error("not found"));
    const ids = await readAdminLeagueIds("admin:missing@example.com:leagues");
    expect(ids).toEqual([]);
    expect(mockListLeagueRefs).not.toHaveBeenCalled();
  });
});
