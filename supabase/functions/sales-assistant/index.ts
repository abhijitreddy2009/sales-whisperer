import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, goal, style, currentStage, conversationHistory } = await req.json();

    console.log("Request:", { transcript, currentStage });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build minimal context for speed
    const recentHistory = conversationHistory?.slice(-3) || [];
    const historyText = recentHistory.length > 0 
      ? recentHistory.map((h: { role: string; text: string }) => `${h.role}: "${h.text}"`).join(' → ')
      : '';

    const prompt = `You're a sales coach. Goal: ${goal || "get interest"}. Style: ${style || "warm"}.
${historyText ? `Recent: ${historyText}` : ''}
Caller said: "${transcript}"

Reply JSON only: {"suggestion":"1-2 sentence response","stage":"${currentStage}","tip":"5 words max","callerSentiment":"neutral"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite", // Fastest model
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150, // Short response
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          suggestion: "That's interesting, tell me more.",
          stage: currentStage,
          tip: "Keep listening",
          callerSentiment: "neutral"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON");
      }
    } catch {
      parsed = {
        suggestion: "That's interesting, could you tell me more?",
        stage: currentStage || "discovery",
        tip: "Stay curious",
        callerSentiment: "neutral"
      };
    }

    console.log("Response:", parsed.suggestion?.substring(0, 50));

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      suggestion: "I see. Tell me more about that.",
      stage: "discovery",
      tip: "Listen",
      callerSentiment: "neutral"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
