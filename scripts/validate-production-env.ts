const problems: string[] = [];
const secret = process.env.BETTER_AUTH_SECRET;
const appUrl = process.env.APP_URL ?? process.env.BETTER_AUTH_URL;

if (!secret || secret.length < 32 || secret.includes("replace-with")) {
  problems.push("BETTER_AUTH_SECRET doit contenir un secret aléatoire d’au moins 32 caractères");
}
if (!appUrl) {
  problems.push("APP_URL ou BETTER_AUTH_URL doit être défini");
} else {
  try {
    const url = new URL(appUrl);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
      problems.push("l’URL publique doit utiliser HTTPS");
    }
  } catch {
    problems.push("APP_URL/BETTER_AUTH_URL doit être une URL absolue valide");
  }
}

if (problems.length) {
  console.error(`Configuration de production invalide :\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
