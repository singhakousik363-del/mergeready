import { describe, it, expect } from "vitest";
import { parseGithubUrl } from "./parseUrl";

describe("parseGithubUrl", () => {
  it("parses a normal issue URL", () => {
    const result = parseGithubUrl("https://github.com/facebook/react/issues/123");
    expect(result).toEqual({
      ok: true,
      owner: "facebook",
      repo: "react",
      type: "issue",
      number: 123,
    });
  });

  it("parses a normal pull request URL", () => {
    const result = parseGithubUrl("https://github.com/facebook/react/pull/456");
    expect(result).toEqual({
      ok: true,
      owner: "facebook",
      repo: "react",
      type: "pull",
      number: 456,
    });
  });

  it("parses a URL with a trailing slash", () => {
    const result = parseGithubUrl("https://github.com/facebook/react/issues/123/");
    expect(result).toEqual({
      ok: true,
      owner: "facebook",
      repo: "react",
      type: "issue",
      number: 123,
    });
  });

  it("parses a URL with a #comment fragment", () => {
    const result = parseGithubUrl(
      "https://github.com/facebook/react/issues/123#issuecomment-789"
    );
    expect(result).toEqual({
      ok: true,
      owner: "facebook",
      repo: "react",
      type: "issue",
      number: 123,
    });
  });

  it("parses a URL with a ?query string", () => {
    const result = parseGithubUrl("https://github.com/facebook/react/pull/456?diff=split");
    expect(result).toEqual({
      ok: true,
      owner: "facebook",
      repo: "react",
      type: "pull",
      number: 456,
    });
  });

  it("returns an error for a non-GitHub URL", () => {
    const result = parseGithubUrl("https://gitlab.com/facebook/react/issues/123");
    expect(result.ok).toBe(false);
  });

  it("returns an error when the number is missing", () => {
    const result = parseGithubUrl("https://github.com/facebook/react/issues");
    expect(result.ok).toBe(false);
  });
});
