import express from 'express';
import OpenAI from 'openai';
import { jsonError, requireObjectBody } from '../lib/http.js';
import { requireAuth } from '../lib/userAuth.js';

export function createChatbotRouter() {
  const router = express.Router();
  
  // Initialize OpenAI client if key is available
  let openai = null;
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  const SYSTEM_PROMPT = `You are Ahiajoku, the Igbo deity of agriculture and harvest. 
You are wise, cultural, and knowledgeable about Igbo traditions, the colloquium events, and African heritage.
Answer questions with wisdom, cultural context, and a welcoming tone.
If asked about the colloquium, provide general information based on your knowledge of the event (or say you don't know if specific details are missing).
Keep answers concise (under 200 words) unless asked for a story.`;

  router.post('/ask', requireAuth, async (req, res) => {
    if (!requireObjectBody(req)) return jsonError(res, 400, 'Invalid body');
    
    const message = req.body.message;
    if (!message) return jsonError(res, 400, 'Message is required');

    try {
      if (!openai) {
        // Fallback for when no API key is set
        return res.json({ 
          ok: true, 
          reply: "I am Ahiajoku. The spirits are quiet today (OpenAI API Key missing). Please tell the developers to awaken me properly." 
        });
      }

      const completion = await openai.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message }
        ],
        model: 'gpt-3.5-turbo', // Cost-effective model
        max_tokens: 300,
      });

      const reply = completion.choices[0].message.content;
      res.json({ ok: true, reply });

    } catch (err) {
      console.error('Chatbot error:', err);
      jsonError(res, 500, 'The spirits are confused (Internal Error)');
    }
  });

  return router;
}
