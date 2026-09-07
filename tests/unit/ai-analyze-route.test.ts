import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/ai/analyze/route";

const originalMode = process.env.AI_MODE;

afterEach(() => {
  if (originalMode === undefined) delete process.env.AI_MODE;
  else process.env.AI_MODE = originalMode;
});

describe("POST /api/ai/analyze", () => {
  it("returns the predefined follow-up candidate in Mock mode", async () => {
    process.env.AI_MODE = "mock";
    const response = await POST(new Request("http://localhost/api/ai/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ demoCase: "case-two-follow-up" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mode).toBe("mock");
    expect(body.candidate.handling_category).toBe("low_risk_other");
    expect(body.candidate.subtypes).toEqual(["reissue", "complaint"]);
  });

  it("rejects malformed or expanded request bodies", async () => {
    const response = await POST(new Request("http://localhost/api/ai/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ demoCase: "case-two-follow-up", userFacts: { injected: true } }),
    }));

    expect(response.status).toBe(400);
  });
});
