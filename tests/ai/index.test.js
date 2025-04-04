import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";
import { AIService } from "../../services/ai-service";
import { CustomerSupportAI } from "../../services/customer-support-ai";

describe("AI Integration Tests", () => {
  describe("AI Service", () => {
    let aiService;

    beforeEach(() => {
      aiService = new AIService({
        model: "gpt-2-arabic",
        maxLength: 100,
        temperature: 0.7,
      });
    });

    afterEach(() => {
      aiService = null;
    });

    it("should initialize with correct configuration", () => {
      expect(aiService.model).to.equal("gpt-2-arabic");
      expect(aiService.config.maxLength).to.equal(100);
      expect(aiService.config.temperature).to.equal(0.7);
    });

    it("should generate text in Arabic", async () => {
      const prompt = "مرحبا";
      const response = await aiService.generateText(prompt);
      expect(response).to.be.a("string");
      expect(response.length).to.be.greaterThan(0);
    });

    it("should handle invalid prompts", async () => {
      try {
        await aiService.generateText("");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Invalid prompt");
      }
    });

    it("should respect max length configuration", async () => {
      const prompt = "test prompt";
      const response = await aiService.generateText(prompt);
      expect(response.length).to.be.at.most(100);
    });
  });

  describe("Customer Support AI", () => {
    let supportAI;

    beforeEach(() => {
      supportAI = new CustomerSupportAI({
        language: "ar",
        responseTime: 1000,
      });
    });

    afterEach(() => {
      supportAI = null;
    });

    it("should handle basic customer inquiries", async () => {
      const inquiry = "كيف يمكنني فتح حساب جديد؟";
      const response = await supportAI.handleInquiry(inquiry);
      expect(response).to.be.an("object");
      expect(response).to.have.property("answer");
      expect(response).to.have.property("confidence");
    });

    it("should categorize customer inquiries", () => {
      const inquiries = {
        account: "كيف يمكنني تغيير كلمة المرور؟",
        trading: "كيف يمكنني شراء الأسهم؟",
        technical: "التطبيق لا يعمل",
        general: "ما هي ساعات التداول؟",
      };

      for (const [category, inquiry] of Object.entries(inquiries)) {
        const result = supportAI.categorizeInquiry(inquiry);
        expect(result).to.have.property("category");
        expect(result).to.have.property("confidence");
      }
    });

    it("should handle multi-language support", async () => {
      supportAI.setLanguage("en");
      const enInquiry = "How do I open a new account?";
      const enResponse = await supportAI.handleInquiry(enInquiry);
      expect(enResponse.answer).to.be.a("string");

      supportAI.setLanguage("ar");
      const arInquiry = "كيف يمكنني فتح حساب جديد؟";
      const arResponse = await supportAI.handleInquiry(arInquiry);
      expect(arResponse.answer).to.be.a("string");
    });

    it("should handle error cases", async () => {
      try {
        await supportAI.handleInquiry("");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Invalid inquiry");
      }
    });

    it("should provide response confidence scores", async () => {
      const inquiry = "ما هي العملات المدعومة؟";
      const response = await supportAI.handleInquiry(inquiry);
      expect(response.confidence).to.be.a("number");
      expect(response.confidence).to.be.within(0, 1);
    });

    it("should handle context-aware conversations", async () => {
      const conversation = [
        { role: "user", content: "كيف يمكنني فتح حساب؟" },
        { role: "assistant", content: "يمكنك فتح حساب من خلال..." },
        { role: "user", content: "وما هي المستندات المطلوبة؟" },
      ];

      const response = await supportAI.handleConversation(conversation);
      expect(response).to.have.property("answer");
      expect(response.answer).to.include("مستندات");
    });

    it("should maintain conversation history", () => {
      const maxHistory = supportAI.getMaxHistoryLength();
      for (let i = 0; i < maxHistory + 2; i++) {
        supportAI.addToHistory({
          role: "user",
          content: `Message ${i}`,
        });
      }

      const history = supportAI.getConversationHistory();
      expect(history.length).to.equal(maxHistory);
      expect(history[history.length - 1].content).to.include("Message");
    });
  });
});
