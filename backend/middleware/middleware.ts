import type { NextFunction, Request, Response } from "express";
import { createSupabaseClient } from "../client";
import { prisma } from "../db";

const client = createSupabaseClient();

export async function middleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const authorization = req.headers.authorization;

        if (!authorization) {
            return res.status(401).json({
                message: "Missing authorization header",
            });
        }

        const token = authorization.startsWith("Bearer ")
            ? authorization.substring(7)
            : authorization;

        const { data, error } = await client.auth.getUser(token);

        if (error || !data.user) {
            return res.status(401).json({
                message: "Invalid or expired token",
            });
        }

        const user = data.user;
        const metadata = user.user_metadata ?? {};
        const username = [
            metadata.full_name,
            metadata.name,
            metadata.user_name,
            metadata.preferred_username,
            user.email?.split("@")[0],
        ].find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? null;

        await prisma.user.upsert({
            where: {
                supabaseId: user.id,
            },

            create: {
                id: user.id,
                supabaseId: user.id,
                email: user.email ?? "",
                provider:
                    user.app_metadata?.provider === "github"
                        ? "GITHUB"
                        : "GOOGLE",
                username,
            },

            update: {
                email: user.email ?? "",
                username,
            },
        });

        req.userId = user.id;

        next();
    } catch (error) {
        console.error("Auth middleware error:", error);

        return res.status(500).json({
            message: "Authentication service error",
        });
    }
}
