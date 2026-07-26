const DAY_IDS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

function buildPrompt(currentEntries, message) {
  const summary = (currentEntries || [])
    .map((e) => `- ${e.day} ${e.start}-${e.end}: ${e.activity}`)
    .join("\n");

  return `Ayudas a alguien a construir su horario semanal a partir de lenguaje natural.

Horario actual:
${summary || "(vacío)"}

Nuevo mensaje: "${message}"

Responde ÚNICAMENTE con un JSON válido, sin texto antes ni después, sin bloques de markdown, con esta forma exacta:

{
  "new_entries": [
    {"day": "uno de: lunes, martes, miercoles, jueves, viernes, sabado, domingo, todos", "start": "HH:MM 24h", "end": "HH:MM 24h", "activity": "nombre corto"}
  ],
  "reply": "confirmación breve y amigable, máximo 2 oraciones, en español"
}

Si menciona varios días o actividades, incluye una entrada por cada una. "todos los días"/"diario" = "day": "todos". Si algo no tiene hora clara, usa tu mejor estimación razonable.`;
}

export async function POST(req) {
  try {
    const { currentEntries, message } = await req.json();

    if (!message || typeof message !== "string") {
      return Response.json({ error: "Falta el mensaje" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "Falta configurar GEMINI_API_KEY en el servidor" },
        { status: 500 }
      );
    }

    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(currentEntries, message) }] }],
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();

      console.error("Error de Gemini:", geminiRes.status, errText);

      return Response.json(
        { error: "Error al llamar a la IA", detail: errText },
        { status: 502 }
      );
    }

    const data = await geminiRes.json();

    const raw =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("\n") || "";

    const clean = raw.replace(/```json|```/g, "").trim();

    let parsed;

    try {
      parsed = JSON.parse(clean);
    } catch {
      return Response.json(
        { error: "La IA respondió en un formato inesperado" },
        { status: 502 }
      );
    }

    const safeEntries = (parsed.new_entries || []).filter(
      (entry) =>
        entry &&
        entry.start &&
        entry.end &&
        entry.activity &&
        (entry.day === "todos" || DAY_IDS.includes(entry.day))
    );

    return Response.json({
      new_entries: safeEntries,
      reply: parsed.reply || "Listo, lo agregué.",
    });
  } catch (error) {
    console.error("Error inesperado:", error);

    return Response.json(
      { error: "Error inesperado en el servidor" },
      { status: 500 }
    );
  }
}
