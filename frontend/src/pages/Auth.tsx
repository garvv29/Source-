import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Code2, Search } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config";
import { Button } from "@/components/ui/button";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export default function Auth() {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState<"github" | "google" | null>(null);

    async function login(provider: "github" | "google") {
        setLoading(provider);
        setError("");
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: `${window.location.origin}/` },
        });
        if (error) {
            setError(error.message);
            setLoading(null);
        }
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0b0c] px-5 py-16 text-zinc-100">
            <Link to="/" className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/[0.07] px-3 py-2 text-xs text-zinc-500 transition hover:border-white/[0.14] hover:text-zinc-200 sm:left-8 sm:top-8">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to search
            </Link>
            <section className="relative w-full max-w-[400px]">
                <div className="mb-8 text-center">
                    <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.03]">
                        <Search className="h-[18px] w-[18px] text-zinc-300" />
                    </div>
                    <p className="text-2xl font-semibold tracking-[-0.06em]">Source?</p>
                    <p className="mt-1 font-serif text-xs italic tracking-[0.01em] text-zinc-500">trust me bro.</p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-[#101012] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
                    <div className="mb-7">
                        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.17em] text-zinc-600">Your research desk</p>
                        <h1 className="text-2xl font-medium tracking-[-0.045em]">Get back to the receipts.</h1>
                        <p className="mt-2 text-sm leading-6 text-zinc-500">Sign in to search, keep your history, and follow the sources.</p>
                    </div>
                    <div className="space-y-3">
                        <Button
                            disabled={loading !== null}
                            onClick={() => login("github")}
                            className="h-11 w-full rounded-lg bg-zinc-100 text-zinc-950 hover:bg-white disabled:opacity-60"
                        >
                            <Code2 className="h-4 w-4" />
                            {loading === "github"
                                ? "Connecting to GitHub…"
                                : "Continue with GitHub"}
                        </Button>

                        <Button
                            disabled={loading !== null}
                            onClick={() => login("google")}
                            variant="outline"
                            className="h-11 w-full border-white/[0.1] bg-white/[0.03] text-zinc-100 hover:bg-white/[0.07] disabled:opacity-60"
                        >
                            <span className="text-sm font-semibold">G</span>
                            {loading === "google"
                                ? "Connecting to Google…"
                                : "Continue with Google"}
                        </Button>
                    </div>
                    {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/15 bg-red-400/[0.04] px-3 py-2 text-sm text-red-300">{error}</p>}
                    <div className="mt-6 flex items-start gap-2.5 border-t border-white/[0.07] pt-5 text-xs leading-5 text-zinc-600">
                        <Search className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <p>Your account keeps your search history. Sources stay one click away.</p>
                    </div>
                </div>
                <p className="mt-5 text-center text-[10px] text-zinc-700">No mystery button. GitHub handles sign-in.</p>
            </section>
        </main>
    );
}
