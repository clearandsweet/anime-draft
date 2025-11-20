
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function POST(req: Request) {
    try {
        const { lobby, competition } = await req.json();

        if (!process.env.GOOGLE_API_KEY) {
            return NextResponse.json(
                { error: "Server missing API key" },
                { status: 500 }
            );
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const playersText = lobby.players
            .map((p: any) => {
                const roster = Object.entries(p.slots)
                    .map(([slot, char]: [string, any]) => `- ${slot}: ${char ? char.name.full : "Empty"}`)
                    .join("\n");
                return `Player: ${p.name}\nRoster:\n${roster}`;
            })
            .join("\n\n");

        const prompt = `
You are the judge of an anime character draft competition.
The competition is: "${competition}".

Here are the contestants and their rosters:

${playersText}

Analyze how each team would perform in this specific competition.
Consider the strengths, weaknesses, and personalities of the characters.
Decide on a winner and explain why.
Be creative, funny, and insightful.
Keep it concise (under 300 words).

Format the output as:
**Winner:** [Player Name]
**Reasoning:** [Your explanation]
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ result: text });
    } catch (error) {
        console.error("AI Judge Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate judgment" },
            { status: 500 }
        );
    }
}
