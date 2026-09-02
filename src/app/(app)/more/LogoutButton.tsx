"use client";
import { Button } from "@/components/ui/Button";
import { Bi } from "@/components/ui/Bi";
import { api } from "@/lib/client";

export function LogoutButton() {
  return (
    <Button
      variant="outline"
      className="flex-1"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST", body: {} });
        window.location.href = "/login";
      }}
    >
      <Bi en="Logout" hi="लॉगआउट" />
    </Button>
  );
}
