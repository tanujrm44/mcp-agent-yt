import { z } from "zod";

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  description?: string;
  enum?: string[];
};

function toZod(schema: JsonSchema): z.ZodTypeAny {
  if (
    schema?.enum &&
    Array.isArray(schema.enum) &&
    schema.enum.length > 0
  ) {
    return z.enum(schema.enum as [string, ...string[]]);
  }

  switch (schema?.type) {
    case "string":
      return z.string();

    case "integer":
      return z.number().int();

    case "number":
      return z.number();

    case "boolean":
      return z.boolean();

    case "array":
      return z.array(toZod(schema.items ?? {}));

    case "object":
      return z.object(buildShape(schema));

    default:
      return z.any();
  }
}

function buildShape(schema: JsonSchema): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(schema.required || []);

  for (const [key, prop] of Object.entries(schema.properties || {})) {
    let field = toZod(prop);

    if (prop.description) {
      field = field.describe(prop.description);
    }

    // JSON Schema optional → Zod nullable
    // because OpenAI requires every field to be required.
    if (!required.has(key)) {
      field = field.nullable();
    }

    shape[key] = field;
  }

  return shape;
}

export function jsonSchemaToZod(
  inputSchema?: JsonSchema,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  if (
    !inputSchema?.properties ||
    Object.keys(inputSchema.properties).length === 0
  ) {
    return z.object({});
  }

  return z.object(buildShape(inputSchema));
}
