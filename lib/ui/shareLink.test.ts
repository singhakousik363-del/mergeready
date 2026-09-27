import { describe, it, expect } from "vitest";
import { buildShareSearch, readShareParams } from "./shareLink";

describe("buildShareSearch", () => {
    it("encodes the link and the username", () => {
        expect(buildShareSearch({ url: "https://github.com/stdlib-js/stdlib/issues/12959", username: "MannXo" })).toBe(
            "?url=https%3A%2F%2Fgithub.com%2Fstdlib-js%2Fstdlib%2Fissues%2F12959&user=MannXo"
        );
    });

    it("leaves out an empty username", () => {
        expect(buildShareSearch({ url: " https://github.com/a/b/pull/1 ", username: "  " })).toBe(
            "?url=https%3A%2F%2Fgithub.com%2Fa%2Fb%2Fpull%2F1"
        );
    });
});

describe("readShareParams", () => {
    it("reads back what buildShareSearch wrote", () => {
        const search = buildShareSearch({ url: "https://github.com/stdlib-js/stdlib/pull/15585", username: "AdeshDeshmukh" });
        expect(readShareParams(new URLSearchParams(search))).toEqual({
            url: "https://github.com/stdlib-js/stdlib/pull/15585",
            username: "AdeshDeshmukh",
        });
    });

    it("ignores a missing, empty or far too long url", () => {
        expect(readShareParams(new URLSearchParams(""))).toBeNull();
        expect(readShareParams(new URLSearchParams("url=%20"))).toBeNull();
        expect(readShareParams(new URLSearchParams(`url=${"x".repeat(501)}`))).toBeNull();
    });

    it("keeps the username short; the server checks it properly", () => {
        const result = readShareParams(new URLSearchParams(`url=https://github.com/a/b/issues/1&user=${"a".repeat(60)}`));
        expect(result?.username).toHaveLength(39);
    });
});
