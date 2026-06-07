const API_BASE = "https://munazara-api.onrender.com";

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req, res) {
  const debateId = req.query.id || "";

  let topic = "";
  let winner = null;

  if (debateId) {
    try {
      const apiRes = await fetch(`${API_BASE}/api/debate/${debateId}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        topic = data.topic || "";
        winner = data.winner || null;
      }
    } catch {}
  }

  const title = topic
    ? `${topic} | Munazara`
    : "Munazara — AI Debate, Both Sides, Real Sources";

  const description = topic
    ? winner && winner !== "tie"
      ? `Watch AI argue both sides of "${topic}" — ${winner.toUpperCase()} wins. Powered by Munazara.`
      : `Watch AI argue both sides of "${topic}" with real sources and a judge verdict. Powered by Munazara.`
    : "Watch two AI debaters argue any topic with sources, cross-examination, and a judge verdict.";

  const debateUrl = debateId
    ? `https://munazara.manarattar.com/?debate=${debateId}`
    : "https://munazara.manarattar.com";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Munazara" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(debateUrl)}" />
  <meta property="og:image" content="https://munazara.manarattar.com/og-image.svg" />

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="https://munazara.manarattar.com/og-image.svg" />

  <meta http-equiv="refresh" content="0; url=${esc(debateUrl)}" />
  <script>window.location.replace(${JSON.stringify(debateUrl)});</script>
</head>
<body>
  <p style="font-family:sans-serif;color:#888;padding:2rem">Redirecting to debate…</p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.status(200).send(html);
}
