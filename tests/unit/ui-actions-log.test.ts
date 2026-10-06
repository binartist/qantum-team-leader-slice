import { describe, expect, it } from "vitest";
import { logBack, logOrigin } from "@/ui/actions-log";

describe("AC 43: returning to the actions log", () => {
  it("accepts a single well-formed origin that names one of the page's sites", () => {
    expect(logOrigin("site-b", ["site-a", "site-b"])).toBe("site-b");
    for (const value of [undefined, "", "site-c", ["site-b", "site-b"], "not an id", "constructor"]) {
      expect(logOrigin(value, ["site-a", "site-b"]), String(value)).toBeUndefined();
    }
  });

  it("names the log and returns to that site's section", () => {
    expect(logBack("site-b")).toEqual({ href: "/actions#site-site-b", name: "Actions log" });
  });
});
