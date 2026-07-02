# Solving Plugin CORS Streaming By Modifying Logseq

## Summary

The practical fix is to add a streaming HTTP proxy in Logseq's Electron/main process, then let plugins consume that stream through IPC events.

The current Logseq `exper_request` path already bypasses browser CORS, but it buffers the full response before returning it to the plugin. That makes it unusable for AI SDK streaming, where the plugin needs a real `ReadableStream` and incremental chunks.

## Current Logseq Behavior

The existing request proxy starts in:

- `/home/debanjand/Documents/Projects/logseq/src/main/logseq/api.cljs`
- `exper_request` calls `(ipc/ipc :httpRequest req-id options)`.

The Electron handler is in:

- `/home/debanjand/Documents/Projects/logseq/src/electron/electron/handler.cljs`
- `defmethod handle :httpRequest` performs the HTTP request.

The important limitation is `read-response-body`:

```clojure
(defn- read-response-body
  [^js res type method]
  (if (or (= :HEAD method) (contains? #{204 205} (.-status res)))
    (p/resolved nil)
    (case type
      :json
      (.json res)

      :arraybuffer
      (.arrayBuffer res)

      :base64
      (-> (.arrayBuffer res)
          (p/then #(-> (js/Buffer.from %)
                       (.toString "base64"))))

      :text
      (.text res))))
```

This reads the entire response before resolving the IPC call. It bypasses CORS, but it cannot stream.

## Proposed Logseq Change

Add a new IPC action instead of changing the existing `:httpRequest` contract:

- `:httpStreamRequest`
- `:httpStreamRequestAbort`

The new handler should:

1. Run `fetch` in Logseq's Electron/main context, same as `:httpRequest`.
2. Send response headers/status to the renderer immediately.
3. Read `res.body.getReader()` chunk by chunk.
4. Send each chunk to the renderer via an IPC event.
5. Send an end event when complete.
6. Send an error event when failed.
7. Support abort by storing an `AbortController` in the existing request abort map.

This preserves existing behavior for all plugins using `exper_request`, while exposing true streaming to plugins that opt into the new API.

## Event Contract

Use a per-request renderer event channel:

```text
logseq-http-stream:<req-id>
```

Payloads:

```ts
type LogseqHttpStreamEvent =
    | {
          type: "headers";
          status: number;
          statusText: string;
          ok: boolean;
          url: string;
          headers: Record<string, string>;
      }
    | {
          type: "chunk";
          chunk: number[];
      }
    | {
          type: "end";
      }
    | {
          type: "error";
          error: string;
      };
```

`number[]` is the safest chunk representation because it serializes across IPC reliably. The plugin can reconstruct each chunk with `new Uint8Array(chunk)`.

## Logseq Handler Sketch

Add this near the existing `:httpRequest` handler in `src/electron/electron/handler.cljs`.

This is intentionally a sketch, not a drop-in patch. Names should be adjusted to match Logseq's exact helper conventions.

```clojure
(defn- send-http-stream-event
  [window req-id payload]
  (utils/send-to-renderer window
                          (str "logseq-http-stream:" req-id)
                          payload))

(defmethod handle :httpStreamRequest [window [_ req-id opts]]
  (let [{:keys [url abortable method data body headers timeout]} opts]
    (when-let [method (and (not (string/blank? url))
                           (keyword (string/upper-case (or method "GET"))))]
      (let [payload (if (some? body) body data)
            timeout (when (and (number? timeout) (pos? timeout)) timeout)
            ^js controller (when (or abortable timeout) (AbortController.))
            timeout-id (when (and timeout controller)
                         (js/setTimeout #(.abort controller) timeout))]
        (when controller
          (swap! *request-abort-signals assoc req-id controller))
        (->
         (p/let [^js res (utils/fetch url
                                      (-> {:method method
                                           :headers (and headers (bean/->js headers))}
                                          (merge
                                           (when (and (not (contains? #{:GET :HEAD} method))
                                                      (some? payload))
                                             {:body (request-body->js payload)})
                                           (when controller
                                             {:signal (.-signal controller)}))))]
           (send-http-stream-event window req-id
                                   {:type "headers"
                                    :status (.-status res)
                                    :statusText (.-statusText res)
                                    :ok (.-ok res)
                                    :url (.-url res)
                                    :headers (response-headers->map (.-headers res))})

           (if (or (= :HEAD method) (contains? #{204 205} (.-status res)) (nil? (.-body res)))
             (send-http-stream-event window req-id {:type "end"})
             (let [reader (.getReader (.-body res))]
               (loop []
                 (p/let [result (.read reader)
                         done (.-done result)
                         value (.-value result)]
                   (if done
                     (send-http-stream-event window req-id {:type "end"})
                     (do
                       (send-http-stream-event window req-id
                                               {:type "chunk"
                                                :chunk (js/Array.from value)})
                       (recur))))))))
         (p/catch
          (fn [^js e]
            (send-http-stream-event window req-id
                                    {:type "error"
                                     :error (or (.-message e) (str e))})))
         (p/finally
           (fn []
             (when timeout-id
               (js/clearTimeout timeout-id))
             (swap! *request-abort-signals dissoc req-id))))
        req-id))))

(defmethod handle :httpStreamRequestAbort [_ [_ req-id]]
  (when-let [^js controller (get @*request-abort-signals req-id)]
    (.abort controller)))
```

## Plugin Consumption Sketch

Logseq already exposes these preload APIs to the parent renderer:

- `/home/debanjand/Documents/Projects/logseq/resources/js/preload.js`
- `window.parent.apis.doAction(...)`
- `window.parent.apis.addListener(...)`
- `window.parent.apis.removeListener(...)`

The plugin can wrap the new IPC stream as a normal `fetch`-compatible `Response`:

```ts
async function logseqStreamingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const reqId = crypto.randomUUID();
    const channel = `logseq-http-stream:${reqId}`;
    const apis = (window.parent as any).apis;

    let streamController: ReadableStreamDefaultController<Uint8Array>;

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            streamController = controller;
        },
        cancel() {
            void apis.doAction(["httpStreamRequestAbort", reqId]);
        }
    });

    return new Promise<Response>((resolve, reject) => {
        const cleanup = () => apis.removeListener(channel, listener);

        const listener = (_event: unknown, event: LogseqHttpStreamEvent) => {
            switch (event.type) {
                case "headers":
                    resolve(
                        new Response(stream, {
                            status: event.status,
                            statusText: event.statusText,
                            headers: event.headers
                        })
                    );
                    break;
                case "chunk":
                    streamController.enqueue(new Uint8Array(event.chunk));
                    break;
                case "end":
                    streamController.close();
                    cleanup();
                    break;
                case "error":
                    streamController.error(new Error(event.error));
                    cleanup();
                    reject(new Error(event.error));
                    break;
            }
        };

        apis.addListener(channel, listener);
        void apis.doAction([
            "httpStreamRequest",
            reqId,
            {
                url,
                method: init?.method ?? "GET",
                headers: Object.fromEntries(new Headers(init?.headers).entries()),
                body: init?.body,
                abortable: Boolean(init?.signal)
            },
            "js-obj"
        ]);

        init?.signal?.addEventListener(
            "abort",
            () => {
                void apis.doAction(["httpStreamRequestAbort", reqId]);
                cleanup();
                reject(new DOMException("Aborted", "AbortError"));
            },
            {once: true}
        );
    });
}
```

## Plugin Integration Point

In this plugin, the integration point is:

- `src/logseq/LogseqHttpHelper.ts`
- `LogseqHttpHelper.fetch(...)`

Then `src/index.ts` can keep its existing `window.fetch` override:

```ts
if (url.startsWith("http://") || url.startsWith("https://")) {
    return LogseqHttpHelper.fetch(input, init);
}
```

## Why This Is The Right Boundary

Browser-side plugin code cannot reliably bypass CORS and preserve streaming under the current `lsp://logseq.com` iframe restrictions. The request must be made by a privileged host context.

Logseq's Electron/main process is that privileged context. It already performs CORS-free HTTP requests for `exper_request`; the missing piece is chunk forwarding instead of body buffering.

## Compatibility

This should be additive:

- Existing `exper_request` behavior remains unchanged.
- Existing plugins are not affected.
- Plugins that need streaming can feature-detect `:httpStreamRequest`.
- Older Logseq versions can continue using buffered `exper_request` fallback.

## Security Notes

This does not create a new class of access beyond what `exper_request` already allows, but it does make long-lived streaming requests possible. Logseq should keep the same constraints as `:httpRequest`:

- Use explicit request IDs.
- Support abort.
- Clean up listeners/controllers after `end`, `error`, or abort.
- Do not expose raw Node or Electron APIs to plugins.
- Keep request execution inside the existing IPC command surface.

## Expected Result

After this change, AI SDK providers can receive a normal `Response` object whose `body` is a real `ReadableStream`. Streaming chat output will arrive incrementally instead of appearing only after the model finishes generating.
