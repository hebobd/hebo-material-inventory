
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Eye,
  EyeOff,
  ArrowRight,
  Leaf,
  LockKeyhole,
  Mail,
  Loader2,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

 
async function handleLogin(e: FormEvent<HTMLFormElement>) {
    console.log("LOGIN BUTTON CLICKED");
  e.preventDefault();

  setLoading(true);
  setError("");

  try {
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    if (!data.session) {
      setError("Login session could not be created.");
      return;
    }

    router.replace("/");
    router.refresh();

  } catch (err) {
    console.error("Login error:", err);
    setError("Unable to login. Please try again.");
  } finally {
    setLoading(false);
  }
}


  return (
    <main className="min-h-screen bg-[#F6F3EC] flex items-center justify-center p-5">

      <div className="w-full max-w-[1050px] min-h-[620px] bg-white rounded-3xl shadow-xl overflow-hidden grid md:grid-cols-2">

        {/* LEFT BRAND SECTION */}

        <div className="bg-[#294333] text-white p-10 md:p-14 flex flex-col justify-between relative overflow-hidden">

          <div className="absolute w-80 h-80 rounded-full border border-white/10 -right-32 -top-20" />
          <div className="absolute w-64 h-64 rounded-full border border-white/10 -left-32 bottom-10" />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <Leaf size={27} />
              <span className="text-2xl font-bold tracking-[5px]">
                HEBO
              </span>
            </div>

            <p className="text-xs tracking-[4px] text-white/60 mt-2">
              MATERIAL MANAGEMENT
            </p>
          </div>

          <div className="relative z-10 my-16">
            <p className="text-[#B8C9B2] text-sm mb-5 tracking-widest">
              YOUR BUSINESS. ORGANIZED.
            </p>

            <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
              Manage your
              <br />
              materials with
              <br />
              <span className="text-[#B8C9B2]">
                confidence.
              </span>
            </h1>

            <p className="text-white/60 text-sm leading-7 mt-6 max-w-sm">
              A smarter way to manage raw materials,
              inventory, suppliers and production.
            </p>
          </div>

          <div className="relative z-10 text-xs text-white/40">
            © 2026 HEBO. All rights reserved.
          </div>

        </div>

        {/* RIGHT LOGIN SECTION */}

        <div className="p-8 md:p-14 flex flex-col justify-center">

          <div className="max-w-sm w-full mx-auto">

            <div className="mb-10">
              <span className="text-xs font-semibold tracking-[3px] text-[#80917F]">
                WELCOME BACK
              </span>

              <h2 className="text-3xl font-semibold text-[#26392D] mt-3">
                Sign in
              </h2>

              <p className="text-sm text-gray-500 mt-3">
                Enter your credentials to access your workspace.
              </p>
            </div>

          <form
  onSubmit={handleLogin}
  className="space-y-6"
>

              <div>
                <label className="block text-sm font-medium text-[#344638] mb-2">
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full h-13 border border-[#E5E8E1] rounded-xl pl-12 pr-4 py-3 outline-none focus:border-[#536D57] focus:ring-2 focus:ring-[#536D57]/10 text-sm text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#344638] mb-2">
                  Password
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full h-13 border border-[#E5E8E1] rounded-xl pl-12 pr-12 py-3 outline-none focus:border-[#536D57] focus:ring-2 focus:ring-[#536D57]/10 text-sm text-gray-800"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  {error}
                </p>
              )}

             <button
  type="submit"
  disabled={loading}
  className="w-full h-13 rounded-xl bg-[#294333] hover:bg-[#36563F] text-white font-medium flex items-center justify-center gap-3 transition disabled:opacity-60"
>
  {loading ? (
    <>
      <Loader2 size={18} className="animate-spin" />
      Signing in...
    </>
  ) : (
    <>
      Sign In
      <ArrowRight size={18} />
    </>
  )}
</button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-12">
              Secure access · HEBO Material Management
            </p>

          </div>
        </div>

      </div>
    </main>
  );
}
