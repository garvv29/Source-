/// <reference path="./types/express.d.ts" />

import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { tavily } from "@tavily/core";

import {
    PROMPT_TEMPLATE,
    SYSTEM_PROMPT,
} from "./prompt.ts";

import { prisma } from "./db.ts";
import { middleware } from "./middleware/middleware.ts";

const app = express();

function routeParam(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

function assistantContext(content: string): string {
    return content
        .replace(/<FOLLOW_UPS>[\s\S]*$/i, "")
        .replace(/<\/?ANSWER>/gi, "")
        .trim();
}

app.use(express.json());
app.use(cors());

app.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok" } }));

/* =========================================================
   CLIENTS
   ========================================================= */

const tavilyClient = tavily({
    apiKey: process.env.TAVILY_API_KEY,
});

const llmClient = new OpenAI({
    apiKey: process.env.AI_GATEWAY_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});


/* =========================================================
   GET ALL CONVERSATIONS
   ========================================================= */

app.get(
    "/history",
    middleware,
    async (req, res) => {
        try {
            const userId = req.userId;

            if (!userId) {
                return res.status(401).json({
                    error: "Unauthorized",
                });
            }

            const conversations =
                await prisma.conversation.findMany({
                    where: {
                        userId,
                    },

                    orderBy: {
                        updatedAt: "desc",
                    },

                    include: {
                        _count: { select: { messages: true } },
                    },
                });

            const history =
                conversations.map(
                    (conversation) => ({
                        id: conversation.id,
                        slug: conversation.slug,
                        title:
                            conversation.title ??
                            "Untitled Conversation",
                        createdAt:
                            conversation.createdAt,
                        updatedAt:
                            conversation.updatedAt,
                        messageCount: conversation._count.messages,
                    })
                );

            return res.json({
                success: true,
                data: history,
                count: history.length,
            });
        } catch (error) {
            console.error(
                "GET /history:",
                error
            );

            return res.status(500).json({
                error:
                    "Failed to fetch conversation history",
            });
        }
    }
);


/* =========================================================
   CREATE NEW CONVERSATION
   ========================================================= */

app.post(
    "/history",
    middleware,
    async (req, res) => {
        try {
            const userId = req.userId;

            if (!userId) {
                return res.status(401).json({
                    error: "Unauthorized",
                });
            }

            const requestedTitle = req.body?.title;
            if (requestedTitle !== undefined && (typeof requestedTitle !== "string" || !requestedTitle.trim())) {
                return res.status(400).json({ error: "Title must be a non-empty string" });
            }

            const conversation =
                await prisma.conversation.create({
                    data: {
                        userId,
                        title: requestedTitle?.trim().slice(0, 120) ?? "New Search",
                        slug: crypto.randomUUID(),
                    },
                });

            return res.status(201).json({
                success: true,
                data: conversation,
            });
        } catch (error) {
            console.error(
                "POST /history:",
                error
            );

            return res.status(500).json({
                error:
                    "Failed to create conversation",
            });
        }
    }
);


/* =========================================================
   GET SPECIFIC CONVERSATION
   ========================================================= */

app.get(
    "/history/:id",
    middleware,
    async (req, res) => {
        try {
            const userId = req.userId;
            const id = routeParam(req.params.id);

            if (!userId) {
                return res.status(401).json({
                    error: "Unauthorized",
                });
            }

            if (!id) {
                return res.status(400).json({
                    error:
                        "Conversation ID is required",
                });
            }

            /*
             * Ownership is checked directly
             * inside the query.
             */

            const conversation =
                await prisma.conversation.findFirst({
                    where: {
                        userId,

                        OR: [
                            {
                                id,
                            },
                            {
                                slug: id,
                            },
                        ],
                    },

                });

            if (!conversation) {
                return res.status(404).json({
                    error:
                        "Conversation not found",
                });
            }

            const messages = await prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { createdAt: "asc" },
            });

            return res.json({
                success: true,

                data: {
                    id: conversation.id,

                    slug: conversation.slug,

                    title:
                        conversation.title ??
                        "Untitled Conversation",

                    createdAt:
                        conversation.createdAt,

                    updatedAt:
                        conversation.updatedAt,

                    messages:
                        messages.map(
                            (message) => ({
                                id: message.id,

                                content:
                                    message.content,

                                role: message.role.toLowerCase(),

                                sources: message.sources ?? [],

                                createdAt:
                                    message.createdAt,
                            })
                        ),
                },
            });
        } catch (error) {
            console.error(
                "GET /history/:id:",
                error
            );

            return res.status(500).json({
                error:
                    "Failed to fetch conversation",
            });
        }
    }
);

/* Account and conversation management */
app.get("/me", middleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId! },
            select: {
                id: true, email: true, username: true, provider: true,
                _count: { select: { conversations: true } },
            },
        });
        if (!user) return res.status(404).json({ error: "User not found" });
        return res.json({ success: true, data: {
            id: user.id, email: user.email, username: user.username,
            provider: user.provider.toLowerCase(), conversationCount: user._count.conversations,
        } });
    } catch (error) {
        console.error("GET /me:", error);
        return res.status(500).json({ error: "Failed to fetch account" });
    }
});

app.patch("/history/:id", middleware, async (req, res) => {
    const title = req.body?.title;
    const id = routeParam(req.params.id);
    if (!id) return res.status(400).json({ error: "Conversation ID is required" });
    if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "A non-empty title is required" });
    }
    try {
        const owned = await prisma.conversation.findFirst({
            where: { userId: req.userId!, OR: [{ id }, { slug: id }] },
            select: { id: true },
        });
        if (!owned) return res.status(404).json({ error: "Conversation not found" });
        const conversation = await prisma.conversation.update({
            where: { id: owned.id }, data: { title: title.trim().slice(0, 120) },
        });
        return res.json({ success: true, data: conversation });
    } catch (error) {
        console.error("PATCH /history/:id:", error);
        return res.status(500).json({ error: "Failed to update conversation" });
    }
});

app.delete("/history/:id", middleware, async (req, res) => {
    const id = routeParam(req.params.id);
    if (!id) return res.status(400).json({ error: "Conversation ID is required" });
    try {
        const owned = await prisma.conversation.findFirst({
            where: { userId: req.userId!, OR: [{ id }, { slug: id }] },
            select: { id: true },
        });
        if (!owned) return res.status(404).json({ error: "Conversation not found" });
        await prisma.conversation.delete({ where: { id: owned.id } });
        return res.json({ success: true, data: { id: owned.id, deleted: true } });
    } catch (error) {
        console.error("DELETE /history/:id:", error);
        return res.status(500).json({ error: "Failed to delete conversation" });
    }
});


/* =========================================================
   ASK SOURCE
   ========================================================= */

app.post(
    "/asksource",
    middleware,
    async (req, res) => {
        try {
            const userId = req.userId;

            const {
                query,
                conversationId,
            } = req.body;

            /* ---------------------------------------------
               AUTH
               --------------------------------------------- */

            if (!userId) {
                return res.status(401).json({
                    error: "Unauthorized",
                });
            }

            /* ---------------------------------------------
               VALIDATION
               --------------------------------------------- */

            if (
                typeof query !== "string" ||
                query.trim().length === 0
            ) {
                return res.status(400).json({
                    error:
                        "query is required",
                });
            }

            if (
                typeof conversationId !==
                "string"
            ) {
                return res.status(400).json({
                    error:
                        "conversationId is required",
                });
            }

            const cleanQuery =
                query.trim();

            /* ---------------------------------------------
               VERIFY CONVERSATION OWNERSHIP
               --------------------------------------------- */

            const conversation =
                await prisma.conversation.findFirst(
                    {
                        where: {
                            id: conversationId,
                            userId,
                        },
                    }
                );

            if (!conversation) {
                return res.status(404).json({
                    error:
                        "Conversation not found",
                });
            }

            /* ---------------------------------------------
               WEB SEARCH
               --------------------------------------------- */

            const searchResponse =
                await tavilyClient.search(
                    cleanQuery,
                    {
                        searchDepth:
                            "advanced",
                    }
                );

            const searchResults =
                searchResponse.results;

            /* ---------------------------------------------
               BUILD PROMPT
               --------------------------------------------- */

            const prompt =
                PROMPT_TEMPLATE
                    .replace(
                        "{{WEB_SEARCH_RESULTS}}",
                        JSON.stringify(
                            searchResults
                        )
                    )
                    .replace(
                        "{{USER_QUERY}}",
                        cleanQuery
                    );

            /* ---------------------------------------------
               CREATE USER MESSAGE
               --------------------------------------------- */

            await prisma.message.create({
                data: {
                    conversationId,

                    /*
                     * Change these to USER/ASSISTANT
                     * if your Prisma enum uses uppercase.
                     */
                    role: "USER",

                    content: cleanQuery,
                },
            });

            /* ---------------------------------------------
               LLM
               --------------------------------------------- */

            const result =
                await llmClient.responses.create(
                    {
                        model:
                            "openai/gpt-oss-20b",

                        instructions:
                            SYSTEM_PROMPT,

                        input: prompt,

                        stream: true,
                    }
                );

            /* ---------------------------------------------
               STREAM HEADERS
               --------------------------------------------- */

            res.setHeader(
                "Content-Type",
                "text/plain; charset=utf-8"
            );

            res.setHeader(
                "Cache-Control",
                "no-cache"
            );

            res.setHeader(
                "Connection",
                "keep-alive"
            );

            /* ---------------------------------------------
               STREAM RESPONSE
               --------------------------------------------- */

            let fullResponse = "";

            for await (
                const event of result
            ) {
                if (
                    event.type ===
                    "response.output_text.delta"
                ) {
                    fullResponse +=
                        event.delta;

                    res.write(
                        event.delta
                    );
                }
            }

            /* ---------------------------------------------
               SAVE ASSISTANT MESSAGE
               --------------------------------------------- */

            await prisma.message.create({
                data: {
                    conversationId,

                    role: "ASSISTANT",

                    content:
                        fullResponse,
                    sources: searchResults.map((result) => ({
                        url: result.url,
                        title: result.title,
                    })),
                },
            });

            /* ---------------------------------------------
               UPDATE CONVERSATION
               --------------------------------------------- */

            await prisma.conversation.update(
                {
                    where: {
                        id: conversationId,
                    },

                    data: {
                        /*
                         * Use the first query as
                         * the conversation title.
                         */

                        title:
                            conversation.title ===
                            "New Search"
                                ? cleanQuery.slice(
                                      0,
                                      80
                                  )
                                : undefined,

                        updatedAt:
                            new Date(),
                    },
                }
            );

            /* ---------------------------------------------
               SOURCES
               --------------------------------------------- */

            res.write(
                "\n<SOURCES>\n"
            );

            res.write(
                JSON.stringify(
                    searchResults.map(
                        (result) => ({
                            url: result.url,
                            title:
                                result.title,
                        })
                    )
                )
            );

            res.write(
                "\n</SOURCES>\n"
            );

            res.end();
        } catch (error) {
            console.error(
                "POST /asksource:",
                error
            );

            if (!res.headersSent) {
                return res.status(500).json({
                    error:
                        "Failed to process request",
                });
            }

            res.end();
        }
    }
);


/* =========================================================
   FOLLOW-UP
   ========================================================= */

app.post(
    "/asksource/followup",
    middleware,
    async (req, res) => {
        try {
            const userId = req.userId;

            const {
                conversationId,
                query,
            } = req.body;

            /* ---------------------------------------------
               AUTH
               --------------------------------------------- */

            if (!userId) {
                return res.status(401).json({
                    error: "Unauthorized",
                });
            }

            /* ---------------------------------------------
               VALIDATION
               --------------------------------------------- */

            if (
                typeof conversationId !==
                "string"
            ) {
                return res.status(400).json({
                    error:
                        "conversationId is required",
                });
            }

            if (
                typeof query !== "string" ||
                query.trim().length === 0
            ) {
                return res.status(400).json({
                    error:
                        "query is required",
                });
            }

            const cleanQuery =
                query.trim();

            /* ---------------------------------------------
               GET CONVERSATION
               --------------------------------------------- */

            const conversation =
                await prisma.conversation.findFirst(
                    {
                        where: {
                            id: conversationId,
                            userId,
                        },

                        include: {
                            messages: {
                                orderBy: {
                                    createdAt:
                                        "asc",
                                },
                            },
                        },
                    }
                );

            if (!conversation) {
                return res.status(404).json({
                    error:
                        "Conversation not found",
                });
            }

            /* ---------------------------------------------
               BUILD HISTORY
               --------------------------------------------- */

            const history: { role: "user" | "assistant"; content: string }[] =
                conversation.messages.map(
                    (message) => ({
                        role: message.role === "USER" ? "user" : "assistant",

                        content:
                            message.role === "ASSISTANT"
                                ? assistantContext(message.content)
                                : message.content,
                    })
                );

            /*
             * Add current question.
             */

            history.push({
                role: "user",
                content: cleanQuery,
            });

            /* ---------------------------------------------
               SAVE USER MESSAGE
               --------------------------------------------- */

            await prisma.message.create({
                data: {
                    conversationId,

                    role: "USER",

                    content: cleanQuery,
                },
            });

            /* ---------------------------------------------
               LLM
               --------------------------------------------- */

            const result =
                await llmClient.responses.create(
                    {
                        model:
                            "openai/gpt-oss-20b",

                        instructions:
                            SYSTEM_PROMPT,

                        input: history,

                        stream: true,
                    }
                );

            /* ---------------------------------------------
               STREAM
               --------------------------------------------- */

            res.setHeader(
                "Content-Type",
                "text/plain; charset=utf-8"
            );

            res.setHeader(
                "Cache-Control",
                "no-cache"
            );

            res.setHeader(
                "Connection",
                "keep-alive"
            );

            let fullResponse = "";

            for await (
                const event of result
            ) {
                if (
                    event.type ===
                    "response.output_text.delta"
                ) {
                    fullResponse +=
                        event.delta;

                    res.write(
                        event.delta
                    );
                }
            }

            /* ---------------------------------------------
               SAVE ASSISTANT MESSAGE
               --------------------------------------------- */

            await prisma.message.create({
                data: {
                    conversationId,

                    role: "ASSISTANT",

                    content:
                        fullResponse,
                },
            });

            /* ---------------------------------------------
               UPDATE CONVERSATION
               --------------------------------------------- */

            await prisma.conversation.update(
                {
                    where: {
                        id: conversationId,
                    },

                    data: {
                        updatedAt:
                            new Date(),
                    },
                }
            );

            res.end();
        } catch (error) {
            console.error(
                "POST /asksource/followup:",
                error
            );

            if (!res.headersSent) {
                return res.status(500).json({
                    error:
                        "Failed to process follow-up",
                });
            }

            res.end();
        }
    }
);


/* =========================================================
   SERVER
   ========================================================= */

export default app;
