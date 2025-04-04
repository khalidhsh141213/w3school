const axios = require("axios");
require("dotenv").config();

// Set up constants
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://0.0.0.0:5000";

async function testAiService() {
  console.log("Testing AI Service...");

  try {
    // 1. Check health
    console.log("Checking health...");
    const healthCheck = await axios.get(`${AI_SERVICE_URL}/health`);
    console.log("Health check response:", healthCheck.data);

    // 2. Generate English text
    console.log("\nGenerating English text...");
    const englishPrompt = "Hello, how can you help me with trading?";
    const englishResponse = await axios.post(`${AI_SERVICE_URL}/generate`, {
      prompt: englishPrompt,
      max_length: 50,
    });
    console.log("English prompt:", englishPrompt);
    // Check for either response format (support both old and new)
    const englishResult =
      englishResponse.data.response || englishResponse.data.generated_text;
    console.log("Response:", englishResult);

    // 3. Generate Arabic text
    console.log("\nGenerating Arabic text...");
    const arabicPrompt = "مرحبا، كيف يمكنك مساعدتي في التداول؟";
    const arabicResponse = await axios.post(`${AI_SERVICE_URL}/generate`, {
      prompt: arabicPrompt,
      max_length: 50,
    });
    console.log("Arabic prompt:", arabicPrompt);
    // Check for either response format (support both old and new)
    const arabicResult =
      arabicResponse.data.response || arabicResponse.data.generated_text;
    console.log("Response:", arabicResult);

    console.log("\nAI Service test completed successfully!");
  } catch (error) {
    console.error("AI Service test failed:");
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    } else if (error.request) {
      console.error("No response received. Is the AI service running?");
    } else {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

testAiService();
