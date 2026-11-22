import type { Catalogue, MessageKey } from "./catalogue";

export type MessageValues = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, values?: MessageValues) => string;

/** Returns `t(key, values)`, which looks the key up and fills `{name}` placeholders. */
export function createTranslator(catalogue: Catalogue): Translate {
  return (key, values) => {
    const message = catalogue[key];
    if (!values) return message;
    return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      Object.hasOwn(values, name) ? String(values[name]) : placeholder,
    );
  };
}
