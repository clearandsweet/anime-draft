
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.GOOGLE_API_KEY;

type ModelListResponse = {
    models?: Array<{
        name?: string;
        displayName?: string;
    }>;
};

async function listModels() {
    try {
        const key = apiKey;
        if (!key) {
            console.error("No API Key found in process.env");
            return;
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json() as ModelListResponse;

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach((model) => {
                console.log(`- ${model.name ?? "Unnamed model"} (${model.displayName ?? "No display name"})`);
            });
        } else {
            console.log("No models found or error:", data);
        }

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
