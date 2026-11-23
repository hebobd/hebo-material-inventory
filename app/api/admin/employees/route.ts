import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";



async function getClients() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const authClient = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Cookie writes may be unavailable in a Route Handler context.
        }
      },
    },
  });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY on the server.");
  const adminClient = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { authClient, adminClient };
}


async function requireAdmin() {
  const { authClient, adminClient } = await getClients();

  // Verify the currently logged-in user
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json(
        { error: "Authentication required. Please sign in again." },
        { status: 401 }
      ),
    };
  }

  // Find the matching profile using the authenticated user ID
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Admin profile lookup failed:", profileError);

    return {
      response: NextResponse.json(
        {
          error: "Unable to verify admin profile.",
          details: profileError.message,
        },
        { status: 500 }
      ),
    };
  }

  if (!profile) {
    return {
      response: NextResponse.json(
        {
          error: "No profile found for the logged-in user.",
          authUserId: user.id,
        },
        { status: 403 }
      ),
    };
  }

  if (String(profile.role).trim().toLowerCase() !== "admin") {
    return {
      response: NextResponse.json(
        {
          error: "Your account does not have Admin role.",
          currentRole: profile.role,
        },
        { status: 403 }
      ),
    };
  }

  if (profile.is_active !== true) {
    return {
      response: NextResponse.json(
        { error: "Your Admin account is inactive." },
        { status: 403 }
      ),
    };
  }

  return { authClient, adminClient, user };
}

export async function GET() {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const { data, error } = await access.adminClient
    .from("profiles")
    .select("id,full_name,role,phone,is_active,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: authUsers, error: usersError } = await access.adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });
  const emailById = new Map((authUsers.users ?? []).map((u) => [u.id, u.email ?? ""]));
  return NextResponse.json({ employees: (data ?? []).map((employee) => ({ ...employee, email: emailById.get(employee.id) ?? "" })) });
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  const body = await request.json().catch(() => null);
  const full_name = String(body?.full_name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const role = String(body?.role ?? "staff").toLowerCase();
  const phone = String(body?.phone ?? "").trim() || null;

  if (!full_name || !email || password.length < 10) {
    return NextResponse.json({ error: "Name, email and a password of at least 10 characters are required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!["manager", "staff"].includes(role)) {
    return NextResponse.json({ error: "New employee role must be Manager or Staff." }, { status: 400 });
  }

  const { data: created, error: createError } = await access.adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "Unable to create auth user." }, { status: 400 });
  }

  const { error: profileError } = await access.adminClient.from("profiles").upsert({
    id: created.user.id,
    full_name,
    role,
    phone,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  if (profileError) {
    await access.adminClient.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: `Profile creation failed: ${profileError.message}` }, { status: 500 });
  }

  return NextResponse.json({ employee: { id: created.user.id, email, full_name, role, phone, is_active: true } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  const body = await request.json().catch(() => null);
  const userId = String(body?.user_id ?? "");
  const is_active = body?.is_active;
  const role = body?.role;
  if (!userId || (typeof is_active !== "boolean" && !["admin", "manager", "staff"].includes(String(role)))) {
    return NextResponse.json({ error: "Provide user_id and either is_active or a valid role." }, { status: 400 });
  }
  if (userId === access.user.id && (is_active === false || role && role !== "admin")) {
    return NextResponse.json({ error: "You cannot deactivate yourself or remove your own Admin role." }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof is_active === "boolean") updates.is_active = is_active;
  if (role) updates.role = role;
  const { error: profileError } = await access.adminClient.from("profiles").update(updates).eq("id", userId);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

  if (typeof is_active === "boolean") {
    const { error: authError } = await access.adminClient.auth.admin.updateUserById(userId, {
      ban_duration: is_active ? "none" : "876000h",
    });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
