import { withBase } from "@cloudflare/nimbus-docs/runtime";
import { config } from "virtual:nimbus/config";

export const prerender = true;

export function GET() {
  const body = [
    "User-agent: *",
    // No Content Signals line yet: Miso hasn't chosen a policy
    // (https://contentsignals.org). Add one deliberately.
    "Allow: /",
    "",
    `Sitemap: ${new URL(withBase("/sitemap-index.xml", import.meta.env.BASE_URL), config.site).href}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
