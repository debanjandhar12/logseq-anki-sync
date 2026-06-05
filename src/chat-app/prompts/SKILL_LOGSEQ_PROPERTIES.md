---
name: Logseq Properties
description: Use when creating, reading, or inspecting properties in Logseq DB graphs. Covers DB property APIs, scalar values, and cardinality-many values.
disable-model-invocation: false
default-installed-skill: true
---

# Logseq Properties Skill

This skill is for DB-version Logseq graphs only. DB properties are first-class database entities, not text maps.

## Creating Properties in DB Graphs

Use DB property APIs instead of writing `key:: value` text.

```ts
await logseq.Editor.upsertProperty("skill_query_text", {
    type: "default",
    cardinality: "one",
    hide: false,
    public: true
});
```

Set block property values with `upsertBlockProperty`:

```ts
await logseq.Editor.upsertBlockProperty(block.uuid, "skill_query_text", "alpha");
```

For many-valued properties, create the schema with `cardinality: "many"` and pass an array:

```ts
await logseq.Editor.upsertBlockProperty(block.uuid, "skill_query_authors", [
    "Ada Lovelace",
    "Alan Turing"
]);
```

## Reading Property Values

For current DB graphs through the plugin SDK, use `Editor.getBlockProperties` for block property values. This was verified for text, number, checkbox, and cardinality-many values.

### Text Property Value

```ts
const properties = await logseq.Editor.getBlockProperties(block.uuid);
expect(properties?.skill_query_text).toBe("alpha");
```

### Number Property Value

```ts
const properties = await logseq.Editor.getBlockProperties(block.uuid);
expect(properties?.skill_query_rating).toBe(5);
```

### Checkbox Property Value

```ts
const properties = await logseq.Editor.getBlockProperties(block.uuid);
expect(properties?.skill_query_flag).toBe(true);
```

### Cardinality-Many Property Values

Use `getBlockProperties`; the value is returned as an array.

```ts
const properties = await logseq.Editor.getBlockProperties(block.uuid);
expect(properties?.skill_query_authors).toEqual(["Ada Lovelace", "Alan Turing"]);
```

## Property API Quick Reference

- `logseq.Editor.getProperty(key)`
- `logseq.Editor.upsertProperty(key, schema, opts?)`
- `logseq.Editor.removeProperty(key)`
- `logseq.Editor.upsertBlockProperty(blockUuid, key, value, opts?)`
- `logseq.Editor.removeBlockProperty(blockUuid, key)`
- `logseq.Editor.getBlockProperty(blockUuid, key)`
- `logseq.Editor.getBlockProperties(blockUuid)`
- `logseq.Editor.getPageProperties(pageName)`
