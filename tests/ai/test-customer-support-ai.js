import axios from "axios";
import dotenv from "dotenv";
import { promises as fs } from "fs";

dotenv.config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://0.0.0.0:5000";
const LOG_FILE = "support-ai-test-results.log";

// Customer support test queries in both English and Arabic
const TEST_QUERIES = [
  {
    language: "English",
    query: "How do I deposit funds to my account?",
    category: "Account Management",
  },
  {
    language: "English",
    query: "What are the trading fees for stocks?",
    category: "Trading",
  },
  {
    language: "English",
    query: "I forgot my password. How can I reset it?",
    category: "Account Management",
  },
  {
    language: "English",
    query: "How do I place a market order?",
    category: "Trading",
  },
  {
    language: "English",
    query: "The price chart isn't loading. What should I do?",
    category: "Technical Issue",
  },
  {
    language: "Arabic",
    query: "كيف يمكنني إيداع الأموال في حسابي؟",
    category: "Account Management",
  },
  {
    language: "Arabic",
    query: "ما هي رسوم التداول للأسهم؟",
    category: "Trading",
  },
  {
    language: "Arabic",
    query: "نسيت كلمة المرور. كيف يمكنني إعادة تعيينها؟",
    category: "Account Management",
  },
];

async function logToFile(message) {
  await fs.appendFile(LOG_FILE, message + "\n");
}

async function clearLogFile() {
  try {
    await fs.writeFile(LOG_FILE, "");
  } catch (error) {
    console.error("Error clearing log file:", error);
  }
}

async function testAiService() {
  console.log("Testing Customer Support AI Service...");
  await clearLogFile();
  await logToFile("CUSTOMER SUPPORT AI TEST RESULTS\n");
  await logToFile(`Date: ${new Date().toISOString()}\n`);

  try {
    // 1. Check health and model information
    console.log("Checking health...");
    const healthCheck = await axios.get(`${AI_SERVICE_URL}/health`);
    console.log("Health check response:", healthCheck.data);

    await logToFile(`Health Check: ${JSON.stringify(healthCheck.data)}`);
    await logToFile(`Model: ${healthCheck.data.model}\n`);

    if (healthCheck.data.model !== "bigscience/bloom-560m") {
      console.error("WARNING: The model being used is not Bloom 560M!");
      await logToFile("⚠️ WARNING: The model being used is not Bloom 560M!\n");
    }

    // 2. Test queries
    console.log("\nTesting support queries...");
    await logToFile("TEST QUERIES RESULTS\n");

    for (const [index, test] of TEST_QUERIES.entries()) {
      console.log(`\nTest ${index + 1}: ${test.language} - ${test.category}`);
      console.log(`Query: ${test.query}`);

      const enhancedPrompt = `Customer Service Request: ${test.query}\nPlease provide a helpful, accurate, and friendly response about trading or platform support:`;

      const startTime = Date.now();
      const response = await axios.post(`${AI_SERVICE_URL}/generate`, {
        prompt: enhancedPrompt,
        max_length: 150,
        temperature: 0.7,
      });
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Get the response text from either response format (old or new)
      const responseData =
        response.data.response || response.data.generated_text;

      // Clean up the response
      const result = responseData.replace(enhancedPrompt, "").trim();

      console.log(`Response (${responseTime}ms): ${result}`);

      await logToFile(`Test ${index + 1}: ${test.language} - ${test.category}`);
      await logToFile(`Query: ${test.query}`);
      await logToFile(`Response Time: ${responseTime}ms`);
      await logToFile(`Response: ${result}`);
      await logToFile("---\n");
    }

    console.log("\nCustomer Support AI testing completed successfully!");
    console.log(`Full results written to ${LOG_FILE}`);
  } catch (error) {
    console.error("Customer Support AI testing failed:");
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
      await logToFile(
        `ERROR: HTTP ${error.response.status} - ${JSON.stringify(error.response.data)}`,
      );
    } else if (error.request) {
      console.error("No response received. Is the AI service running?");
      await logToFile(
        "ERROR: No response received. Is the AI service running?",
      );
    } else {
      console.error("Error:", error.message);
      await logToFile(`ERROR: ${error.message}`);
    }
    process.exit(1);
  }
}

testAiService();
