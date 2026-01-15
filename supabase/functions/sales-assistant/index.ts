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
      ? recentHistory.map((h: { role: string; text: string }) => 
          h.role === 'caller' ? `Client: "${h.text}"` : `You said: "${h.text}"`
        ).join(' → ')
      : '';

    const prompt = `You are writing a script for a COLD CALLER (salesperson). 
The cold caller's goal: ${goal || "get the client interested"}
Style: ${style || "warm, professional"}

${historyText ? `Conversation so far: ${historyText}` : ''}

The CLIENT (person being called) just said: "${transcript}"

Write what the COLD CALLER should say next. Keep it natural, 1-2 sentences max.

Reply in JSON only:
{"suggestion":"what the cold caller should say","stage":"${currentStage}","tip":"3-5 word tip","callerSentiment":"positive/neutral/hesitant/negative"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          suggestion: "I totally understand. Could I ask what's your biggest challenge with that right now?",
          stage: currentStage,
          tip: "Keep them talking",
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
        suggestion: "I hear you. What would make the biggest difference for you right now?",
        stage: currentStage || "discovery",
        tip: "Ask open questions",
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
      suggestion: "That makes sense. What's been your experience with that?",
      stage: "discovery",
      tip: "Stay curious",
      callerSentiment: "neutral"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
