import {describe, expect, test} from "vitest";
import {parseNetworkAllowlist} from "../../../../../../src/core/just-bash-wrapper/network/policy/parseNetworkAllowlist";

describe("parseNetworkAllowlist", () => {
    test("ignores comments and blank lines", () => {
        expect(
            parseNetworkAllowlist("# comment\n\n  # indented comment\nexample.com\n \n")
        ).toEqual(new Set(["example.com"]));
    });

    test("trims and lowercases hosts", () => {
        expect(parseNetworkAllowlist("  EXAMPLE.COM  \n\tAPI.Example.COM\t")).toEqual(
            new Set(["example.com", "api.example.com"])
        );
    });

    test("accepts CRLF line endings", () => {
        expect(parseNetworkAllowlist("# comment\r\nexample.com\r\napi.example.com\r\n")).toEqual(
            new Set(["example.com", "api.example.com"])
        );
    });

    test("deduplicates normalized hosts", () => {
        expect(parseNetworkAllowlist("example.com\n EXAMPLE.COM \nexample.com")).toEqual(
            new Set(["example.com"])
        );
    });

    test.each([
        "",
        " \n\t\r\n",
        "# comment\n  # another comment\n"
    ])("rejects input without hosts: %j", (source) => {
        expect(() => parseNetworkAllowlist(source)).toThrow(
            "Network allowlist contains an invalid host."
        );
    });

    test.each([
        "https://example.com",
        "example.com/path",
        "example.com:443",
        "*.example.com",
        "example_com",
        "example com",
        "example.com # inline comment",
        "-example.com",
        "example-.com",
        "example..com",
        "example.com.",
        `${"a".repeat(64)}.com`,
        `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.com`,
        "127.0.0.2",
        "127.1",
        "2130706433",
        "[::1]"
    ])("rejects invalid characters in a host: %j", (host) => {
        expect(() => parseNetworkAllowlist(`valid.example\n${host}`)).toThrow(
            "Network allowlist contains an invalid host at line 2."
        );
    });

    test("accepts explicit local services", () => {
        expect(parseNetworkAllowlist("localhost\n127.0.0.1")).toEqual(
            new Set(["localhost", "127.0.0.1"])
        );
    });
});
