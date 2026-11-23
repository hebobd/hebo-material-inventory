
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("[AUTH CHECK]", {
  pathname: request.nextUrl.pathname,
  userId: user?.id ?? null,
  email: user?.email ?? null,
  authenticated: !!user,
});

  const isLoginPage = request.nextUrl.pathname === "/login";

  // Not logged in
  if (!user && !isLoginPage) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);

    return NextResponse.redirect(url);
  }

  // Verify user role
  if (user) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

console.log("[AUTH DEBUG]", {
  pathname: request.nextUrl.pathname,
  userId: user?.id,
  profile,
  profileError: error?.message,
});
console.log("[ROLE DEBUG]", {
  userId: user?.id,
  profile,
  profileError: error?.message,
  profileRole: profile?.role,
});
    const validRole =
      !error &&
      profile &&
      ["admin", "staff"].includes(profile.role);

    if (!validRole && !isLoginPage) {
      const url = new URL("/login", request.url);
      url.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(url);
    }

    // Already authenticated: go to dashboard
    if (validRole && isLoginPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
