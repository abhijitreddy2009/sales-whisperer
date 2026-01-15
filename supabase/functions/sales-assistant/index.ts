import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SALES_STAGES = [
  'greeting',
  'rapport',
  'discovery',
  'value',
  'objection',
  'next_step',
  'close'
] as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, goal, style, currentStage, conversationHistory } = await req.json();

    console.log("Received request:", { transcript, goal, style, currentStage });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert sales coach providing REAL-TIME guidance during a cold call. The user is on a call right now and needs INSTANT, actionable suggestions.

CONTEXT:
- Goal: ${goal || "Get them interested in learning more about the product/service"}
- Communication style: ${style || "warm, professional, concise"}
- Current stage: ${currentStage || "greeting"}

SALES FLOW STAGES:
1. GREETING - Brief, warm opener. Get permission to talk.
2. RAPPORT - Quick personal connection. Find common ground.
3. DISCOVERY - Ask about their current situation, pain points.
4. VALUE - Present how you solve their specific problems.
5. OBJECTION - Handle concerns with empathy and facts.
6. NEXT_STEP - Propose a concrete next action (demo, meeting).
7. CLOSE - Confirm the commitment, set expectations.

YOUR TASK:
Based on what the caller just said, provide:
1. "suggestion" - The EXACT words the user should say next (1-2 short sentences max)
2. "stage" - Which stage we're now in
3. "tip" - A quick tactical tip (10 words max)
4. "callerSentiment" - "positive", "neutral", "hesitant", or "negative"

RULES:
- Keep suggestions SHORT and NATURAL - people don't talk in long paragraphs
- Mirror the caller's energy level
- If they seem rushed, be concise
- If they show interest, expand slightly
- Never sound scripted or robotic
- Use the caller's own words when possible
- If handling objection, acknowledge before redirecting

Respond in JSON format only:
{
  "suggestion": "exact words to say",
  "stage": "current_stage",
  "tip": "brief tactical tip",
  "callerSentiment": "sentiment"
}`;

    const messages = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history for context
    if (conversationHistory && conversationHistory.length > 0) {
      const historyContext = conversationHistory
        .slice(-6) // Last 6 exchanges for context
        .map((h: { role: string; text: string }) => `${h.role}: "${h.text}"`)
        .join('\n');
      
      messages.push({
        role: "user",
        content: `Recent conversation:\n${historyContext}\n\nCaller just said: "${transcript}"\n\nWhat should I say next?`
      });
    } else {
      messages.push({
        role: "user",
        content: `Caller just said: "${transcript}"\n\nWhat should I say next?`
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded. Please wait a moment.",
          suggestion: "Take a breath, let them speak...",
          stage: currentStage,
          tip: "Pause and listen",
          callerSentiment: "neutral"
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", data);

    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in response");
    }

    // Parse the JSON response
    let parsed;
    try {
      // Extract JSON from the response (it might be wrapped in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Parse error:", parseError, "Content:", content);
      // Fallback response
      parsed = {
        suggestion: "That's interesting, tell me more about that.",
        stage: currentStage || "discovery",
        tip: "Keep them talking",
        callerSentiment: "neutral"
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in sales-assistant:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      suggestion: "I understand. Could you tell me more?",
      stage: "discovery",
      tip: "Stay curious",
      callerSentiment: "neutral"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
