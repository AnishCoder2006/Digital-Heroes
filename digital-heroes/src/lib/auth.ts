import * as React from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Role } from "@/types/database";

const cache = typeof React.cache === "function"
  ? React.cache
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  : <T extends (...args: any[]) => any>(fn: T): T => fn;

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  const profile = await getProfile();
  return { user, profile: profile as Profile };
}

/**
 * Server Component / Action guard that enforces one or more allowed user roles.
 * Redirects unauthenticated users to /login and unauthorized users to /dashboard.
 */
export async function requireRole(allowedRoles: Role | Role[]) {
  const { user, profile } = await requireUser();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!profile || !roles.includes(profile.role)) {
    redirect("/dashboard");
  }
  return { user, profile };
}

export async function requireAdmin() {
  return requireRole("admin");
}

/**
 * API route guard to authenticate the current session user.
 * Returns a 401 JSON response if unauthenticated.
 */
export async function authenticateApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      user: null,
      profile: null,
      response: NextResponse.json({ error: "Please log in first." }, { status: 401 }),
    };
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile: (profile as Profile | null) ?? null, response: null };
}

/**
 * API route guard to enforce role authorization (e.g. ['admin', 'auditor']).
 * Returns 401 if unauthenticated and 403 if unauthorized with a consistent JSON shape.
 */
export async function authorizeApiRole(allowedRoles: Role | Role[]) {
  const { user, profile, response } = await authenticateApiUser();
  if (response) {
    return { user: null, profile: null, response };
  }

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!profile || !roles.includes(profile.role)) {
    return {
      user: null,
      profile: null,
      response: NextResponse.json({ error: "Forbidden: insufficient permissions." }, { status: 403 }),
    };
  }

  return { user, profile, response: null };
}


