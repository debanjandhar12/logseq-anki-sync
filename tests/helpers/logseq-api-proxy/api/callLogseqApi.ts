interface LogseqApiRequest {
    apiServer: string;
    apiToken: string;
    method: string;
    args: unknown[];
}

export async function callLogseqApi({
    apiServer,
    apiToken,
    method,
    args
}: LogseqApiRequest): Promise<unknown> {
    let response: Response;
    try {
        response = await fetch(`${apiServer}/api`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiToken}`
            },
            body: JSON.stringify({method, args})
        });
    } catch {
        throw new Error(`${method}: network request failed`);
    }

    let data: unknown;
    try {
        data = response.headers.get("Content-Type")?.includes("application/json")
            ? await response.json()
            : await response.text();
    } catch {
        throw new Error(`${method} (HTTP ${response.status}): invalid response body`);
    }

    const apiError =
        typeof data === "object" && data !== null && Object.hasOwn(data, "error")
            ? (data as {error: unknown}).error
            : null;
    if (!response.ok || apiError != null) {
        const detail =
            typeof apiError === "string"
                ? apiError
                : typeof data === "string"
                  ? data
                  : "API request failed";
        const safeDetail = apiToken ? detail.split(apiToken).join("[redacted]") : detail;
        throw new Error(`${method} (HTTP ${response.status}): ${safeDetail.slice(0, 500)}`);
    }

    return data;
}
