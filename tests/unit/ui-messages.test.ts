import { describe, expect, it } from "vitest";
import {
  ANNOUNCE,
  BUTTONS,
  SITES_UNAVAILABLE,
  CREW_STAYS,
  EMPTY,
  filterLine,
  PENETRATION_FILTER,
  GIVE_REASON,
  MANAGER_CHECK,
  RECORDS_ONLY,
  STOCK_STALE,
  SUBSTITUTES,
  apiErrorMessage,
  readinessBanner,
} from "@/ui/messages";

const TABLE = [
  ["validation_failed", "Check the highlighted fields."],
  ["payload_too_large", "That's too long. Shorten it."],
  ["shortage_not_found", "That shortage no longer exists. Refresh to see the latest."],
  ["stale_nomination", "This penetration's nomination has changed. Refresh and try again."],
  ["not_a_candidate", "That solution is no longer a candidate. Refresh and try again."],
  ["idempotency_key_reused", "Something went wrong sending that. Close this and try again."],
  ["upstream_unavailable", "A system we depend on isn't available. Nothing was recorded. Try again."],
  ["upstream_invalid", "A system we depend on isn't available. Nothing was recorded. Try again."],
] as const;

describe("API error messages", () => {
  it.each(TABLE)("maps %s", (code, message) => {
    expect(apiErrorMessage(code)).toBe(message);
  });

  it("uses one generic fallback for anything else", () => {
    const fallback = "Something went wrong. Nothing was recorded.";
    expect(apiErrorMessage("internal_error")).toBe(fallback);
    expect(apiErrorMessage("wait_not_allowed_for_blocker")).toBe(fallback);
    expect(apiErrorMessage("idempotency_key_required")).toBe(fallback);
    expect(apiErrorMessage("no_such_code")).toBe(fallback);
    expect(apiErrorMessage("")).toBe(fallback);
  });

  it("never returns the server's own sentence", () => {
    expect(apiErrorMessage("shortage_not_found")).not.toBe("Shortage not found.");
  });

  it("a lost response does not claim the decision was dropped", () => {
    expect(apiErrorMessage("transport_failed")).toBe(
      "Couldn't reach the server. The decision may not have been recorded. Send again to retry; it won't be recorded twice.",
    );
    expect(apiErrorMessage("transport_failed")).not.toContain("Nothing was recorded");
  });
});

describe("banners and empty states", () => {
  it("AC 9: the unavailable banner tells the leader not to assume the site is clear", () => {
    const banner = readinessBanner("unavailable");
    expect(banner.label).toBe("Can't check this site right now. Don't assume it's clear. Try again.");
    expect(banner.tone).toBe("warning");
    expect(banner.icon).toBe("warning");
    expect(banner.label).not.toContain("Crew can go");
  });

  it("maps the other crew banners", () => {
    expect(readinessBanner("clear").label).toBe("Crew can go");
    expect(readinessBanner("nothing_planned")).toEqual({
      label: "Nothing planned for this site",
      tone: "neutral",
      icon: "dashed-circle",
    });
    expect(readinessBanner("blocked")).toEqual({ label: "Blocked: hold the crew.", tone: "danger", icon: "stop" });
    expect(readinessBanner("clear")).toEqual({ label: "Crew can go", tone: "success", icon: "check" });
  });

  it("AC 34: the site screen's blocked banner is short; the tab counts carry the detail", () => {
    expect(readinessBanner("blocked").label).toBe("Blocked: hold the crew.");
    expect(readinessBanner("blocked").label).not.toMatch(/\d/);
  });

  it("an unknown crew status uses the unavailable banner, never Crew can go", () => {
    expect(readinessBanner("bogus")).toEqual(readinessBanner("unavailable"));
    expect(readinessBanner("bogus").label).not.toContain("Crew can go");
  });

  it("words the penetration filter", () => {
    expect(filterLine("Intumescent sealant, 310 ml cartridge", 12, 12)).toBe("Using Intumescent sealant, 310 ml cartridge · 12 of 12");
    expect(PENETRATION_FILTER.showAll).toBe("Show all");
    expect(PENETRATION_FILTER.unknown).toBe("That material is not a shortage on this site. Showing all penetrations.");
  });

  it("has the approved empty states and the fixed decision lines", () => {
    expect(EMPTY.sites).toBe("No sites to show.");
    expect(EMPTY.actions).toBe("Nothing recorded for this site yet.");
    expect(CREW_STAYS).toBe("This does not release the crew.");
    expect(GIVE_REASON).toBe("Give a reason.");
    expect(MANAGER_CHECK).toBe("A manager has to verify this catalogue match.");
    expect(RECORDS_ONLY).toBe("This records your decision here. Nobody is notified automatically yet.");
    expect(STOCK_STALE).toBe("These stock figures are more than a day old. Check with the warehouse before relying on them.");
    expect(SUBSTITUTES).toBe("Substitutes");
    expect(BUTTONS).toEqual({
      wait: "Wait",
      escalate: "Escalate",
      propose: "Propose this",
      sendEscalation: "Send escalation",
      sendWait: "Send wait",
      sendProposal: "Send proposal",
      cancel: "Cancel",
      sending: "Sending…",
      tryAgain: "Try again",
    });
    expect(ANNOUNCE).toEqual({
      escalation: "Escalation recorded",
      wait: "Wait recorded",
      proposal: "Proposal recorded",
      replay: "Already recorded",
    });
  });
});

describe("forbidden words", () => {
  it("no message contains compatible or approved", () => {
    const texts = [
      ...TABLE.map(([code]) => apiErrorMessage(code)),
      apiErrorMessage("nope"),
      readinessBanner("clear").label,
      readinessBanner("blocked").label,
      readinessBanner("nothing_planned").label,
      readinessBanner("unavailable").label,
      ...Object.values(EMPTY),
      ...Object.values(BUTTONS),
      ...Object.values(ANNOUNCE),
      apiErrorMessage("transport_failed"),
      readinessBanner("bogus").label,
      CREW_STAYS,
      GIVE_REASON,
      MANAGER_CHECK,
      RECORDS_ONLY,
      STOCK_STALE,
      SUBSTITUTES,
      SITES_UNAVAILABLE,
    ];
    for (const text of texts) expect(text).not.toMatch(/compatible|approved/i);
  });
});
