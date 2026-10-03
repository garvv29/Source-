import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

import {
    Search,
    Plus,
    LogOut,
    Menu,
    X,
    ArrowUp,
    Globe2,
    ExternalLink,
    Loader2,
    Copy,
    Check,
    MoreHorizontal,
    Pencil,
    Trash2,
} from "lucide-react";
import { MarkdownAnswer, parseAssistantSections, type AnswerSource } from "../components/MarkdownAnswer";

import {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
} from "../config";

import { BACKEND_URL } from "@/lib/config";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Avatar,
    AvatarFallback,
} from "@/components/ui/avatar";

import {
    ScrollArea,
} from "@/components/ui/scroll-area";

import {
    Separator,
} from "@/components/ui/separator";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

type Conversation = {
    id: string;
    slug?: string | null;
    title: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
};

type Message = {
    id?: string;
    role: "user" | "assistant";
    content: string;
    createdAt?: string;
    sources?: AnswerSource[];
};

type Source = AnswerSource;

type AccountProfile = {
    username: string | null;
    provider: string;
    conversationCount: number;
};

export default function Dashboard() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<AccountProfile | null>(null);

    const [conversations, setConversations] = useState<
        Conversation[]
    >([]);

    const [messages, setMessages] = useState<Message[]>([]);

    const [activeConversation, setActiveConversation] =
        useState<string | null>(null);

    const [query, setQuery] = useState("");

    const [loading, setLoading] = useState(false);

    const [loadingHistory, setLoadingHistory] =
        useState(true);

    const [mobileSidebar, setMobileSidebar] =
        useState(false);

    const [sources, setSources] = useState<Source[]>([]);

    const [copied, setCopied] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const chatScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            const viewport = chatScrollRef.current?.querySelector<HTMLElement>(
                '[data-slot="scroll-area-viewport"]',
            );
            const answer = chatScrollRef.current?.querySelector<HTMLElement>(
                "[data-answer-scroll-target]",
            );
            if (!viewport || !answer) return;

            const viewportBottom = viewport.getBoundingClientRect().bottom;
            const answerBottom = answer.getBoundingClientRect().bottom;
            if (answerBottom > viewportBottom) {
                viewport.scrollTop += answerBottom - viewportBottom;
            }
        });

        return () => cancelAnimationFrame(frame);
    }, [messages, sources]);

    const metadata = user?.user_metadata as Record<string, unknown> | undefined;
    const accountName = profile?.username?.trim()
        || (typeof metadata?.full_name === "string" ? metadata.full_name : "")
        || (typeof metadata?.name === "string" ? metadata.name : "")
        || (typeof metadata?.user_name === "string" ? metadata.user_name : "")
        || user?.email?.split("@")[0]
        || "Your account";

    /*
     * -------------------------------------------------------
     * AUTH
     * -------------------------------------------------------
     */

    useEffect(() => {
        async function getUser() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (user) {
                setUser(user);
            }
        }

        getUser();
    }, []);

    /*
     * -------------------------------------------------------
     * GET JWT
     * -------------------------------------------------------
     */

    const getJWT = async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        return session?.access_token;
    };

    /*
     * -------------------------------------------------------
     * LOAD HISTORY
     * -------------------------------------------------------
     */

    const loadHistory = useCallback(async () => {
        try {
            setLoadingHistory(true);

            const jwt = await getJWT();

            if (!jwt) return;

            const response = await fetch(
                `${BACKEND_URL}/history`,
                {
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to load history"
                );
            }

            const result = await response.json();

            setConversations(result.data ?? []);
        } catch (error) {
            console.error(
                "History error:",
                error
            );
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        if (user) {
            loadHistory();
        }
    }, [user, loadHistory]);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        void (async () => {
            const jwt = await getJWT();
            if (!jwt) return;
            try {
                const response = await fetch(`${BACKEND_URL}/me`, {
                    headers: { Authorization: `Bearer ${jwt}` },
                });
                if (!response.ok) return;
                const result = await response.json();
                if (!cancelled) setProfile(result.data);
            } catch (error) {
                console.error("Account profile error:", error);
            }
        })();
        return () => { cancelled = true; };
    }, [user]);

    /*
     * -------------------------------------------------------
     * LOAD CONVERSATION
     * -------------------------------------------------------
     */

    const openConversation = async (
        conversationId: string
    ) => {
        try {
            const jwt = await getJWT();

            if (!jwt) return;

            const response = await fetch(
                `${BACKEND_URL}/history/${conversationId}`,
                {
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to load conversation"
                );
            }

            const result = await response.json();

            setActiveConversation(
                result.data.id
            );

            const conversationMessages: Message[] = result.data.messages ?? [];
            setMessages(conversationMessages);

            const savedSources = new Map<string, Source>();
            for (const message of conversationMessages) {
                for (const source of message.sources ?? []) {
                    if (source.url) savedSources.set(source.url, source);
                }
            }
            setSources([...savedSources.values()]);

            setSources([]);

            setMobileSidebar(false);
        } catch (error) {
            console.error(
                "Conversation error:",
                error
            );
        }
    };

    /*
     * -------------------------------------------------------
     * NEW CONVERSATION
     * -------------------------------------------------------
     */

    const createConversation = async () => {
        try {
            const jwt = await getJWT();

            if (!jwt) return null;

            const response = await fetch(
                `${BACKEND_URL}/history`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        title: "New Search",
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to create conversation"
                );
            }

            const result = await response.json();

            const conversation =
                result.data;

            setActiveConversation(
                conversation.id
            );

            setMessages([]);
            setSources([]);

            await loadHistory();

            return conversation.id;
        } catch (error) {
            console.error(
                "Create conversation error:",
                error
            );

            return null;
        }
    };

    const updateConversationTitle = async (conversation: Conversation) => {
        const title = window.prompt("Rename conversation", conversation.title);
        if (!title?.trim()) return;
        const jwt = await getJWT();
        if (!jwt) return;
        const response = await fetch(`${BACKEND_URL}/history/${conversation.id}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
        });
        if (!response.ok) return;
        setConversations((items) => items.map((item) => item.id === conversation.id ? { ...item, title: title.trim().slice(0, 120) } : item));
    };

    const deleteConversation = async (conversation: Conversation) => {
        if (!window.confirm(`Delete “${conversation.title}”? This cannot be undone.`)) return;
        const jwt = await getJWT();
        if (!jwt) return;
        const response = await fetch(`${BACKEND_URL}/history/${conversation.id}`, {
            method: "DELETE", headers: { Authorization: `Bearer ${jwt}` },
        });
        if (!response.ok) return;
        setConversations((items) => items.filter((item) => item.id !== conversation.id));
        if (activeConversation === conversation.id) {
            setActiveConversation(null);
            setMessages([]);
            setSources([]);
        }
    };

    /*
     * -------------------------------------------------------
     * PARSE STREAM
     * -------------------------------------------------------
     */

    const parseSources = (
        text: string
    ) => {
        const index = text.search(/<SOURCES>/i);

        if (index === -1) {
            return {
                answer: text,
                sources: [],
            };
        }

        const marker = text.match(/<SOURCES>/i)?.[0] ?? "<SOURCES>";
        const payloadStart = index + marker.length;
        const closingIndex = text.search(/<\/SOURCES>/i);
        const sourcePart = text.slice(payloadStart, closingIndex < 0 ? undefined : closingIndex).trim();
        const answer = text.slice(0, index).trimEnd();

        try {
            const parsed =
                JSON.parse(sourcePart);

            return {
                answer,
                sources: Array.isArray(parsed) ? parsed.filter((source) => typeof source?.url === "string") : [],
            };
        } catch {
            return {
                answer,
                sources: [],
            };
        }
    };

    /*
     * -------------------------------------------------------
     * ASK SOURCE
     * -------------------------------------------------------
     */

    const askSource = async () => {
        const trimmed =
            query.trim();

        if (!trimmed || loading) {
            return;
        }

        setQuery("");
        setLoading(true);
        setSources([]);

        let conversationId =
            activeConversation;

        /*
         * Create conversation if this
         * is a new search.
         */

        if (!conversationId) {
            conversationId =
                await createConversation();

            if (!conversationId) {
                setLoading(false);
                return;
            }
        }

        const userMessage: Message = {
            role: "user",
            content: trimmed,
        };

        setMessages((prev) => [
            ...prev,
            userMessage,
        ]);

        /*
         * Empty assistant message so
         * streaming can update it.
         */

        setMessages((prev) => [
            ...prev,
            {
                role: "assistant",
                content: "",
            },
        ]);

        try {
            const jwt = await getJWT();

            if (!jwt) {
                throw new Error(
                    "Not authenticated"
                );
            }

            const response = await fetch(
                `${BACKEND_URL}/asksource`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        query: trimmed,
                        conversationId
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Request failed"
                );
            }

            if (!response.body) {
                throw new Error(
                    "No response stream"
                );
            }

            const reader =
                response.body.getReader();

            const decoder =
                new TextDecoder();

            let fullText = "";

            while (true) {
                const {
                    done,
                    value,
                } = await reader.read();

                if (done) break;

                const chunk =
                    decoder.decode(
                        value,
                        {
                            stream: true,
                        }
                    );

                fullText += chunk;

                const {
                    answer,
                    sources,
                } =
                    parseSources(
                        fullText
                    );

                setMessages((prev) => {
                    const updated =
                        [...prev];

                    const lastIndex =
                        updated.length - 1;

                    if (
                        updated[lastIndex]
                            ?.role ===
                        "assistant"
                    ) {
                        updated[
                            lastIndex
                        ] = {
                            ...updated[
                                lastIndex
                            ],
                            content:
                                answer,
                        };
                    }

                    return updated;
                });

                if (sources.length) {
                    setSources(sources);
                }
            }

            const parsed =
                parseSources(
                    fullText
                );

            setSources(
                parsed.sources
            );

            /*
             * Refresh sidebar so message
             * count / updatedAt changes.
             */

            await loadHistory();
        } catch (error) {
            console.error(
                "Ask error:",
                error
            );

            setMessages((prev) => {
                const updated =
                    [...prev];

                const lastIndex =
                    updated.length - 1;

                if (
                    updated[lastIndex]
                        ?.role ===
                    "assistant"
                ) {
                    updated[
                        lastIndex
                    ] = {
                        ...updated[
                            lastIndex
                        ],
                        content:
                            "Something went wrong while researching this question.",
                    };
                }

                return updated;
            });
        } finally {
            setLoading(false);
        }
    };

    /*
     * -------------------------------------------------------
     * FOLLOW UP
     * -------------------------------------------------------
     */

    const askFollowUp = async (followUp = query) => {
        if (
            !activeConversation ||
            !followUp.trim() ||
            loading
        ) {
            return;
        }

        const trimmed = followUp.trim();

        setQuery("");
        setLoading(true);

        setMessages((prev) => [
            ...prev,
            {
                role: "user",
                content: trimmed,
            },
            {
                role: "assistant",
                content: "",
            },
        ]);

        try {
            const jwt = await getJWT();

            if (!jwt) {
                throw new Error(
                    "Not authenticated"
                );
            }

            const response = await fetch(
                `${BACKEND_URL}/asksource/followup`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        conversationId:
                            activeConversation,
                        query: trimmed,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Follow-up failed"
                );
            }

            if (!response.body) {
                throw new Error(
                    "No response stream"
                );
            }

            const reader =
                response.body.getReader();

            const decoder =
                new TextDecoder();

            while (true) {
                const {
                    done,
                    value,
                } = await reader.read();

                if (done) break;

                const chunk =
                    decoder.decode(
                        value,
                        {
                            stream: true,
                        }
                    );

                setMessages((prev) => {
                    const updated =
                        [...prev];

                    const lastIndex =
                        updated.length - 1;

                    const lastMessage = updated[lastIndex];
                    if (lastMessage?.role === "assistant") {
                        updated[lastIndex] = {
                            ...lastMessage,
                            content: lastMessage.content + chunk,
                        };
                    }

                    return updated;
                });
            }

            await loadHistory();
        } catch (error) {
            console.error(
                "Follow-up error:",
                error
            );
        } finally {
            setLoading(false);
        }
    };

    /*
     * -------------------------------------------------------
     * SUBMIT
     * -------------------------------------------------------
     */

    const handleSubmit = () => {
        if (activeConversation) {
            askFollowUp();
        } else {
            askSource();
        }
    };

    /*
     * -------------------------------------------------------
     * COPY
     * -------------------------------------------------------
     */

    const copyAnswer = async () => {
        const assistantMessages =
            messages.filter(
                (message) =>
                    message.role ===
                    "assistant"
            );

        const latest =
            assistantMessages[
                assistantMessages.length -
                    1
            ];

        if (!latest) return;
        const { answer } = parseAssistantSections(latest.content);
        if (!answer) return;

        await navigator.clipboard.writeText(
            answer
        );

        setCopied(true);

        setTimeout(() => {
            setCopied(false);
        }, 1500);
    };

    /*
     * -------------------------------------------------------
     * LOGOUT
     * -------------------------------------------------------
     */

    const logout = async () => {
        await supabase.auth.signOut();

        setUser(null);
        setProfile(null);
        setMessages([]);
        setConversations([]);
        setActiveConversation(null);
    };

    /*
     * -------------------------------------------------------
     * ENTER KEY
     * -------------------------------------------------------
     */

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>
    ) => {
        if (
            e.key === "Enter" &&
            !e.shiftKey
        ) {
            e.preventDefault();
            handleSubmit();
        }
    };

    /*
     * -------------------------------------------------------
     * NOT AUTHENTICATED
     * -------------------------------------------------------
     */

    if (!user) {
        return (
            <main className="min-h-screen bg-[#0b0b0c] text-zinc-100 lg:h-dvh lg:min-h-0">
                <header className="mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between px-6 sm:px-10">
                    <a href="/" className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.035]"><Search className="h-4 w-4 text-zinc-300" /></span>
                        <span>
                            <span className="block text-base font-semibold tracking-[-0.05em]">Source?</span>
                            <span className="mt-0.5 block font-serif text-xs italic text-zinc-500">trust me bro.</span>
                        </span>
                    </a>
                    <a href="/auth" className="rounded-full border border-white/[0.09] px-4 py-2 text-xs text-zinc-400 transition hover:border-white/[0.17] hover:text-zinc-100">Sign in</a>
                </header>

                <div className="mx-auto grid min-h-[calc(100svh-72px)] w-full max-w-6xl items-center gap-14 px-6 pb-16 pt-8 sm:px-10 lg:h-[calc(100svh-72px)] lg:min-h-0 lg:py-0 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
                    <section className="max-w-xl">
                        <div className="mb-6 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.17em] text-zinc-500">
                            <Globe2 className="h-3.5 w-3.5" /> Web research, minus the hand-waving
                        </div>
                        <h1 className="text-5xl font-semibold leading-[1.04] tracking-[-0.065em] text-zinc-100 sm:text-6xl">
                            Curiosity, with a <span className="text-zinc-500">paper trail.</span>
                        </h1>
                        <p className="mt-6 max-w-lg text-base leading-7 text-zinc-400">
                            Ask a question. Get a clear answer, links you can inspect, and follow-ups worth clicking. The internet has opinions; we bring receipts.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            <Button onClick={() => { window.location.href = "/auth"; }} className="h-11 rounded-xl bg-zinc-100 px-5 text-zinc-950 hover:bg-white">
                                Start researching <ArrowUp className="ml-1 h-4 w-4 rotate-45" />
                            </Button>
                            <span className="text-xs text-zinc-600">Sign in with GitHub to save your searches</span>
                        </div>
                    </section>

                    <section aria-label="How Source works" className="rounded-2xl border border-white/[0.08] bg-[#101012] p-5 sm:p-7">
                        <div className="mb-6 flex items-center justify-between border-b border-white/[0.07] pb-4">
                            <div>
                                <p className="text-sm font-medium text-zinc-200">A little less “trust me”</p>
                                <p className="mt-1 text-xs text-zinc-600">A research answer should show its work.</p>
                            </div>
                            <span className="rounded-md border border-white/[0.08] px-2 py-1 text-[9px] font-semibold text-zinc-500">S?</span>
                        </div>
                        <div className="space-y-1">
                            {[
                                { number: "01", title: "Search the web", detail: "Start with current pages, not confident guesswork." },
                                { number: "02", title: "Read the answer", detail: "Get the useful part in clear, structured Markdown." },
                                { number: "03", title: "Check the sources", detail: "Open citations and decide whether they hold up." },
                            ].map((item) => (
                                <div key={item.number} className="flex gap-4 rounded-xl px-3 py-4 transition hover:bg-white/[0.025]">
                                    <span className="pt-0.5 font-mono text-[10px] text-zinc-700">{item.number}</span>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-300">{item.title}</p>
                                        <p className="mt-1 text-xs leading-5 text-zinc-600">{item.detail}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        );
    }

    /*
     * -------------------------------------------------------
     * DASHBOARD
     * -------------------------------------------------------
     */

    return (
        <div className="h-screen overflow-hidden bg-[#0b0b0c] text-zinc-100">
            {/* Mobile overlay */}

            {mobileSidebar && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 lg:hidden"
                    onClick={() =>
                        setMobileSidebar(false)
                    }
                />
            )}

            <div className="flex h-full">
                {/* =================================================
                    SIDEBAR
                ================================================= */}

                <aside
                    className={`
                        fixed inset-y-0 left-0 z-50
                        flex w-[270px] flex-col
                        border-r border-white/[0.07]
                        bg-[#0e0e10]
                        transition-transform
                        lg:static lg:translate-x-0
                        ${
                            mobileSidebar
                                ? "translate-x-0"
                                : "-translate-x-full"
                        }
                    `}
                >
                    {/* Brand */}

                    <div className="flex h-16 items-center justify-between px-5">
                        <button
                            onClick={() => {
                                setActiveConversation(
                                    null
                                );
                                setMessages([]);
                                setSources([]);
                                setMobileSidebar(
                                    false
                                );
                            }}
                            className="text-left"
                        >
                            <div className="text-[20px] font-semibold tracking-[-0.055em]">
                                Source?
                            </div>

                            <div className="mt-0.5 font-serif text-[12px] italic tracking-[0.01em] text-zinc-500">
                                trust me bro.
                            </div>
                        </button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden"
                            onClick={() =>
                                setMobileSidebar(
                                    false
                                )
                            }
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="px-3">
                        <Button
                            onClick={() => {
                                setActiveConversation(
                                    null
                                );
                                setMessages([]);
                                setSources([]);
                                setMobileSidebar(
                                    false
                                );
                            }}
                            variant="outline"
                            className="
                                h-10 w-full
                                justify-start gap-2
                                rounded-lg
                                border-white/[0.08]
                                bg-white/[0.025]
                                text-zinc-300
                                hover:bg-white/[0.06]
                                hover:text-white
                            "
                        >
                            <Plus className="h-4 w-4" />
                            New search
                        </Button>
                    </div>

                    <Separator className="my-4 bg-white/[0.06]" />

                    {/* History */}

                    <div className="px-4 pb-2">
                        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">
                            History
                        </p>
                    </div>

                    <ScrollArea className="min-h-0 flex-1 px-2">
                        {loadingHistory ? (
                            <div className="space-y-2 px-2">
                                {[1, 2, 3].map(
                                    (item) => (
                                        <div
                                            key={item}
                                            className="h-9 animate-pulse rounded-lg bg-white/[0.025]"
                                        />
                                    )
                                )}
                            </div>
                        ) : conversations.length ===
                          0 ? (
                            <div className="px-3 py-8 text-center">
                                <p className="text-xs text-zinc-600">
                                    No searches yet. Start one and we’ll keep it here.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {conversations.map(
                                    (
                                        conversation
                                    ) => (
                                        <div
                                            key={
                                                conversation.id
                                            }
                                            className={`group flex items-center rounded-lg transition ${activeConversation === conversation.id ? "bg-white/[0.07] text-white" : "text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-300"}`}
                                        >
                                            <button onClick={() => openConversation(conversation.id)} className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-[13px]">
                                                {
                                                    conversation.title
                                                }
                                            </button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button aria-label={`Options for ${conversation.title}`} className="mr-1 rounded-md p-1.5 text-zinc-600 opacity-0 transition hover:bg-white/[0.07] hover:text-zinc-300 group-hover:opacity-100 focus:opacity-100"><MoreHorizontal className="h-4 w-4" /></button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="border-white/[0.08] bg-[#151517]">
                                                    <DropdownMenuItem onSelect={() => updateConversationTitle(conversation)} className="text-zinc-300 focus:bg-white/[0.06] focus:text-white"><Pencil className="mr-2 h-3.5 w-3.5" />Rename</DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-white/[0.08]" />
                                                    <DropdownMenuItem onSelect={() => deleteConversation(conversation)} className="text-red-400 focus:bg-red-400/10 focus:text-red-300"><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Account */}

                    <div className="border-t border-white/[0.06] p-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                asChild
                            >
                                <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-white/[0.04]">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="bg-zinc-800 text-xs text-zinc-300">
                                            {accountName.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs text-zinc-300">
                                            {accountName}
                                        </p>

                                        <p className="text-[10px] capitalize text-zinc-600">
                                            {profile?.provider ? `${profile.provider} · ${profile.conversationCount} searches` : "Account"}
                                        </p>
                                    </div>

                                    <MoreHorizontal className="h-4 w-4 text-zinc-600" />
                                </button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                                side="top"
                                align="start"
                                className="w-[230px] border-white/[0.08] bg-[#151517]"
                            >
                                <DropdownMenuItem
                                    onClick={
                                        logout
                                    }
                                    className="text-zinc-300 focus:bg-white/[0.06] focus:text-white"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </aside>

                {/* =================================================
                    MAIN
                ================================================= */}

                <main className="relative flex min-w-0 flex-1 flex-col">
                    {/* Top bar */}

                    <header className="flex h-16 items-center border-b border-white/[0.06] px-4 lg:px-6">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="mr-2 lg:hidden"
                            onClick={() =>
                                setMobileSidebar(
                                    true
                                )
                            }
                        >
                            <Menu className="h-5 w-5" />
                        </Button>

                        <div className="flex items-center gap-2">
                            <Globe2 className="h-4 w-4 text-zinc-600" />

                            <span className="text-xs text-zinc-600">
                                Web research
                            </span>
                        </div>
                    </header>

                    {/* =================================================
                        CONTENT
                    ================================================= */}

                    <div className="flex min-h-0 flex-1 flex-col">
                        {messages.length ===
                        0 ? (
                            /* =========================================
                               EMPTY STATE
                            ========================================= */

                            <div className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-10">
                                <div className="w-full max-w-2xl">
                                    <div className="mb-8 text-center">
                                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                                            <Globe2 className="h-3.5 w-3.5" /> Web research, with receipts
                                        </div>
                                        <h1 className="text-6xl font-semibold tracking-[-0.075em] text-zinc-100 sm:text-7xl">Source?</h1>
                                        <div className="mt-1 font-serif text-lg italic tracking-[0.01em] text-zinc-500">trust me bro.</div>
                                        <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-zinc-500">
                                            The internet has plenty to say. Get an answer with links you can actually check.
                                        </p>
                                    </div>

                                    <SearchBox
                                        query={query}
                                        setQuery={
                                            setQuery
                                        }
                                        onSubmit={
                                            handleSubmit
                                        }
                                        onKeyDown={
                                            handleKeyDown
                                        }
                                        loading={
                                            loading
                                        }
                                        inputRef={
                                            inputRef
                                        }
                                    />

                                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-zinc-600">
                                        <span className="rounded-full border border-white/[0.07] px-3 py-1.5">Search the web</span>
                                        <span className="rounded-full border border-white/[0.07] px-3 py-1.5">Follow the citations</span>
                                        <span className="rounded-full border border-white/[0.07] px-3 py-1.5">Decide for yourself</span>
                                    </div>
                                    <div className="mt-8 border-t border-white/[0.06] pt-5">
                                        <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-700">A few places to start</p>
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {[
                                                "What changed in technology this week?",
                                                "Compare two approaches to learning a language",
                                                "What does the latest research say about sleep?",
                                            ].map((suggestion) => (
                                                <button
                                                    key={suggestion}
                                                    type="button"
                                                    onClick={() => {
                                                        setQuery(suggestion);
                                                        inputRef.current?.focus();
                                                    }}
                                                    className="rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left text-xs text-zinc-500 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-zinc-200"
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* =========================================
                               CHAT
                            ========================================= */

                            <>
                                <ScrollArea ref={chatScrollRef} className="min-h-0 flex-1 overflow-hidden">
                                    <div className="mx-auto w-full max-w-3xl px-5 py-10">
                                        <div className="space-y-10">
                                            {messages.map(
                                                (
                                                    message,
                                                    index
                                                ) => (
                                                    <MessageBlock
                                                        key={
                                                            message.id ??
                                                            index
                                                        }
                                                        message={
                                                            message
                                                        }
                                                        animateWords={loading && index === messages.length - 1 && message.role === "assistant"}
                                                        scrollTarget={index === messages.length - 1 && message.role === "assistant"}
                                                        loading={
                                                            loading &&
                                                            index ===
                                                                messages.length -
                                                                    1
                                                        }
                                                        sources={message.sources?.length ? message.sources : sources}
                                                        onFollowUp={askFollowUp}
                                                        showFollowUps={index === messages.length - 1 && !loading}
                                                        showCopy={index === messages.length - 1 && !loading}
                                                        copied={copied}
                                                        onCopy={copyAnswer}
                                                    />
                                                )
                                            )}

                                            {/* Sources */}

                                            {sources.length >
                                                0 && (
                                                <div className="pt-2">
                                                    <div className="mb-3 flex items-center gap-2">
                                                        <span className="text-xs font-medium text-zinc-400">
                                                            Sources
                                                        </span>

                                                        <span className="text-[10px] text-zinc-700">
                                                            {
                                                                sources.length
                                                            }
                                                        </span>
                                                    </div>

                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        {sources.map(
                                                            (
                                                                source,
                                                                index
                                                            ) => (
                                                                <a
                                                                    key={`${source.url}-${index}`}
                                                                    href={
                                                                        source.url
                                                                    }
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="
                                                                        group
                                                                        rounded-xl
                                                                        border
                                                                        border-white/[0.07]
                                                                        bg-white/[0.018]
                                                                        p-3
                                                                        transition
                                                                        hover:bg-white/[0.045]
                                                                    "
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-[10px] font-medium text-zinc-400">
                                                                            {index + 1}
                                                                        </div>

                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="truncate text-xs text-zinc-300">
                                                                                {
                                                                                    source.title ||
                                                                                    source.url
                                                                                }
                                                                            </p>

                                                                            <p className="mt-1 truncate text-[10px] text-zinc-600">
                                                                                {
                                                                                    source.url
                                                                                }
                                                                            </p>
                                                                        </div>

                                                                        <ExternalLink className="h-3 w-3 text-zinc-700 opacity-0 transition group-hover:opacity-100" />
                                                                    </div>
                                                                </a>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </ScrollArea>

                                {/* Bottom composer */}

                                <div className="shrink-0 border-t border-white/[0.06] bg-[#0b0b0c] px-4 py-4">
                                    <div className="mx-auto max-w-3xl">
                                        <SearchBox
                                            query={query}
                                            setQuery={
                                                setQuery
                                            }
                                            onSubmit={
                                                handleSubmit
                                            }
                                            onKeyDown={
                                                handleKeyDown
                                            }
                                            loading={
                                                loading
                                            }
                                            inputRef={
                                                inputRef
                                            }
                                        />

                                        <div className="mt-2 px-1 text-[10px] text-zinc-700">
                                            Sources are below. Click through before you cite.
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

/*
 * =========================================================
 * SEARCH BOX
 * =========================================================
 */

function SearchBox({
    query,
    setQuery,
    onSubmit,
    onKeyDown,
    loading,
    inputRef,
}: {
    query: string;
    setQuery: (
        value: string
    ) => void;
    onSubmit: () => void;
    onKeyDown: (
        event: React.KeyboardEvent<HTMLInputElement>
    ) => void;
    loading: boolean;
    inputRef: React.RefObject<HTMLInputElement | null>;
}) {
    return (
        <div className="relative">
            <div
                className="
                    relative overflow-hidden
                    rounded-2xl
                    border border-white/[0.09]
                    bg-[#111113]
                    shadow-[0_10px_50px_rgba(0,0,0,0.18)]
                    transition
                    focus-within:border-white/[0.16]
                "
            >
                <Input
                    ref={inputRef}
                    value={query}
                    onChange={(e) =>
                        setQuery(
                            e.target.value
                        )
                    }
                    onKeyDown={
                        onKeyDown
                    }
                    placeholder="Ask the internet. We’ll check its homework."
                    disabled={loading}
                    className="
                        h-14
                        border-0
                        bg-transparent
                        px-4
                        pr-14
                        text-sm
                        text-zinc-200
                        shadow-none
                        placeholder:text-zinc-700
                        focus-visible:ring-0
                    "
                />

                <Button
                    size="icon"
                    onClick={onSubmit}
                    disabled={
                        loading ||
                        !query.trim()
                    }
                    className="
                        absolute
                        right-2
                        top-2
                        h-10
                        w-10
                        rounded-xl
                        bg-white
                        text-black
                        hover:bg-zinc-200
                        disabled:bg-zinc-800
                        disabled:text-zinc-600
                    "
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <ArrowUp className="h-4 w-4" />
                    )}
                </Button>
            </div>
        </div>
    );
}

/*
 * =========================================================
 * MESSAGE
 * =========================================================
 */

function MessageBlock({
    message,
    animateWords,
    scrollTarget,
    loading,
    sources,
    onFollowUp,
    showFollowUps,
    showCopy,
    copied,
    onCopy,
}: {
    message: Message;
    animateWords: boolean;
    scrollTarget: boolean;
    loading: boolean;
    sources: Source[];
    onFollowUp: (question: string) => void;
    showFollowUps: boolean;
    showCopy: boolean;
    copied: boolean;
    onCopy: () => void;
}) {
    if (message.role === "user") {
        return (
            <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-white/[0.07] px-4 py-3">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">
                        {message.content}
                    </p>
                </div>
            </div>
        );
    }

    const { answer, followUps } = parseAssistantSections(message.content);

    return (
        <div>
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
                        <span className="text-[9px] font-semibold">S?</span>
                    </div>
                    <span className="text-xs font-medium text-zinc-500">Source?</span>
                </div>
                {showCopy && answer && (
                    <Button variant="ghost" size="sm" onClick={onCopy} className="h-7 gap-1.5 text-[10px] text-zinc-600 hover:text-zinc-300">
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copied ? "Copied" : "Copy answer"}
                    </Button>
                )}
            </div>

            <div data-answer-scroll-target={scrollTarget ? "" : undefined}>
                {answer ? (
                    <MarkdownAnswer content={answer} sources={sources} animateWords={animateWords} />
                ) : loading ? (
                    <div className="flex items-center gap-2 text-zinc-600">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="text-xs">Checking sources…</span>
                    </div>
                ) : null}
            </div>

            {showFollowUps && followUps.length > 0 && (
                <div className="mt-6 border-t border-white/[0.06] pt-4">
                    <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600">Your next rabbit hole</p>
                    <div className="flex flex-wrap gap-2">
                        {followUps.map((question, index) => (
                            <button key={`${question}-${index}`} onClick={() => onFollowUp(question)} className="group flex max-w-full items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-left text-xs leading-5 text-zinc-400 transition hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-zinc-100">
                                <span>{question}</span>
                                <ArrowUp className="h-3 w-3 shrink-0 -rotate-45 text-zinc-600 transition group-hover:text-zinc-300" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
