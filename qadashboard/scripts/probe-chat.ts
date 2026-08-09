(async () => {
  const body = JSON.stringify({
    question: "What is the difference between smoke and regression testing?",
    model: "openrouter/auto",
  });

  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const text = await res.text();
  console.log(text);
})();
