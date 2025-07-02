const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");
const cors = require("cors");

const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const corsHandler = cors({ origin: true });

exports.parseQuery = onRequest(
  { secrets: [GROQ_API_KEY] },
  async (req, res) => {
    console.log("Function HIT");

    corsHandler(req, res, async () => {
      const query = req.body.query;
      console.log("Received query:", query);

      if (!query) {
        console.warn("No query provided");
        return res.status(400).json({ error: "Missing query" });
      }

      try {
        const response = await axios.post(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            model: "llama3-8b-8192",
            messages: [
              {
                role: "system",
                content: `
            You are an intelligent shopping assistant. Your job is to extract structured filters from a user's natural language query for Facebook Marketplace.

            Output a JSON object with these fields:
            {
              "keywords": string,
              "priceMin": number or null,
              "priceMax": number or null,
              "condition": "used-good" | "used-like new" | "used-fair" | "new" | null,
              "location": string or null,
              "sortBy": "newest" | "price_low_to_high" | "price_high_to_low" | null,
              "dateListed": "24 hours" | "7 days" | "30 days" | null,
              "vehicleType": "SUV" | "car" | "truck" | "motorcycle" | "van" | "other" | null,
              "yearMin": number or null,
              "yearMax": number or null,
              "mileageMax": number or null,
              "transmission": "automatic" | "manual" | null,
              "brand": string or null,
              "model": string or null,
              "isVintage": boolean or null
            }

            Rules:
            - Only include fields if they are mentioned or clearly implied.
            - Extract numbers from phrases like “under $10,000”, “less than 100k km”, “2015 or newer”
            - Always prioritize structured fields over descriptive ones.
            - If unsure, leave the field as null.

            Examples:
            User: "Used Toyota RAV4 SUV, 2016 or newer, under $15,000, automatic, less than 100k km, in Calgary"
            → {
              "keywords": "used Toyota RAV4",
              "priceMin": null,
              "priceMax": 15000,
              "condition": "used-good",
              "location": "Calgary",
              "sortBy": null,
              "dateListed": null,
              "vehicleType": "SUV",
              "yearMin": 2016,
              "yearMax": null,
              "mileageMax": 100000,
              "transmission": "automatic",
              "brand": "Toyota",
              "model": "RAV4",
              "isVintage": false
            }

            `
              },
              {
                role: "user",
                content: query
              }
            ],
            temperature: 0.2
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );

        const gptResponse = response.data.choices[0].message.content;
        console.log("Raw Groq response:", gptResponse);

        // Extract JSON from Markdown if present
        const match = gptResponse.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
        const cleaned = match ? match[1].trim() : gptResponse;

        console.log("Cleaned response:", cleaned);
        res.json({ result: cleaned });

      } catch (error) {
        console.error("Groq error:", error.response?.data || error.message);
        res.status(500).json({ error: "Groq request failed" });
      }
    });
  }
);
