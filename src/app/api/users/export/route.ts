import { withAuth, csvResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";

export const GET = withAuth("export.csv", async () => {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, include: { site: { select: { name: true } } } });
  return csvResponse(
    "users.csv",
    users.map((u) => ({
      Username: u.username,
      Name: u.name,
      Phone: u.phone ?? "",
      Role: u.role,
      Site: u.site?.name ?? "",
      Active: u.active ? "Yes" : "No",
      "Last login": formatDateTime(u.lastLoginAt),
    })),
  );
});
