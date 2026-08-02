// Probe which free (:free) OpenRouter models actually honor tool-calling.
// Free-only: never touches a paid model id. Run: node scripts/probe-free-models.mjs
const KEY = process.env.OPENROUTER_API_KEY || "";
if (!KEY) {
  console.error("Set OPENROUTER_API_KEY first.");
  process.exit(1);
}

const models = [
  "inclusionai/ling-3.0-flash:free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-20b:free",
];

const TOOL = {
  type: "function",
  function: {
    name: "get_weather",
    description: "Get the current weather for a city.",
    parameters: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
  },
};

const PROMPT =
  "Call the get_weather function for London. Respond only with the tool call, no prose.";

async function probe(model) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: PROMPT }],
        tools: [TOOL],
        max_tokens: 120,
        temperature: 0,
      }),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { model, status: res.status, parseError: text.slice(0, 160) };
    }
    const msg = data.choices?.[0]?.message;
    const tcs = msg?.tool_calls || [];
    return {
      model,
      status: res.status,
      toolCalls: tcs.map((t) => t.function?.name),
      toolArgs: tcs[0] ? tcs[0].function?.arguments?.slice(0, 80) : "",
      finish: data.choices?.[0]?.finish_reason,
      hasError: Boolean(data.error),
      error: data.error?.message?.slice(0, 120) || "",
      contentHead: typeof msg?.content === "string" ? msg.content.slice(0, 60) : "",
    };
  } catch (err) {
    return { model, exception: String(err).slice(0, 160) };
  }
}

let i = 0;
for (const model of models) {
  const r = await probe(model);
  i++;
  console.log(
    `[${i}/${models.length}] ${r.model}\n` +
      `   status=${r.status} toolCalls=${JSON.stringify(r.toolCalls)} finish=${r.finish} error=${r.error || r.parseError || r.exception || "-"}\n` +
      `   args=${r.toolArgs || "-"} contentHead=${JSON.stringify(r.contentHead)}`
  );
}
