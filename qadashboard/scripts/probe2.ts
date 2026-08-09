(async () => {
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Explain the WebDriver create statement", model: "nvidia/nemotron-3-super-120b-a12b:free" }),
  });
  const text = await res.text();
  const lines = text.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  for (const l of lines) {
    if (l.type === "chunk") process.stdout.write(l.content);
    if (l.type === "sources") console.log("\n\nSOURCES:", JSON.stringify(l.content));
  }
  console.log("\n\nDONE");
})();
