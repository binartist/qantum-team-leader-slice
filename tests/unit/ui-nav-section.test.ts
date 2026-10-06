import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { ABOUT_PATH } from "@/ui/format";
import { navSectionForPath } from "@/ui/nav-section";

describe("AC 47: the side menu's current section follows the path", () => {
  it("maps the landing page, the three sections, and everything else", () => {
    expect(navSectionForPath("/about-this-demo")).toBe("about");
    expect(navSectionForPath("/sites")).toBe("sites");
    expect(navSectionForPath("/sites/")).toBe("sites");
    expect(navSectionForPath("/sites/site-b")).toBe("sites");
    expect(navSectionForPath("/sites/site-b/penetrations/pen-b-01")).toBe("sites");
    expect(navSectionForPath("/materials")).toBe("materials");
    expect(navSectionForPath("/materials/MAT-SEALANT")).toBe("materials");
    expect(navSectionForPath("/actions")).toBe("actions");

    for (const path of ["", "/", "/about-this-demo/extra", "/actions/", "/actions/extra", "/sites-extra", "/materials-extra", "/nope", "/sites?from=1"]) {
      expect(navSectionForPath(path), path).toBe("none");
    }
  });

  it("AC 47: the root redirects to the About page, temporarily so it can change later", async () => {
    expect(ABOUT_PATH).toBe("/about-this-demo");
    expect(await nextConfig.redirects?.()).toEqual([{ source: "/", destination: ABOUT_PATH, permanent: false }]);
  });
});
