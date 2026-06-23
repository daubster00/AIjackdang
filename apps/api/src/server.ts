import { env } from "@ai-jakdang/config";
import { buildApp } from "./app";

const port = env.API_PORT;
const host = env.API_HOST;

async function main() {
  const app = buildApp();
  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
