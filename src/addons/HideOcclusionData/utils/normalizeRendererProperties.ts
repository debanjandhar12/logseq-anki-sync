import {LogseqPropertiesHelper} from "../../../logseq/LogseqPropertiesHelper";

export function normalizeRendererProperties(
    properties: Record<string, unknown>
): Record<string, unknown> {
    // Experiments omits the leading colon expected by the shared property normalizer.
    const prefixedProperties = Object.fromEntries(
        Object.entries(properties).map(([key, value]) => [
            key.startsWith(":") ? key : `:${key}`,
            value
        ])
    );
    return LogseqPropertiesHelper.addStripedPropertyPrefixes(prefixedProperties);
}
