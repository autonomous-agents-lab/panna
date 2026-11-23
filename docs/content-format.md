# Page body format

A page's text lives in `pages.body` as a JSON document. This page is the contract for that
document: what the editor may produce, what the server stores, and what the reader renders.
`src/contracts/page-body/content-format-doc.test.ts` checks this file against the code.

## Why this format

The body is a [ProseMirror](https://prosemirror.net/) document, the JSON that Tiptap's
`editor.getJSON()` returns, limited to an allowlist. So the editor can load and save it with no
conversion, and the server can check it node by node instead of parsing HTML.

In Tiptap terms the editor uses `StarterKit` with everything off except `Document`, `Paragraph`,
`Text`, `Heading` (`levels: [2, 3]`), `Blockquote`, `HardBreak`, `Bold` and `Italic`, plus
`Image` (block-level, the default `inline: false`). Its schema already turns pasted content into
these nodes; anything else reaching the server comes from a buggy or hostile client.

## The allowlist

### Nodes

| Node        | Where it may appear                  | Content                          | Attributes                     |
| ----------- | ------------------------------------ | -------------------------------- | ------------------------------ |
| `doc`       | the root, and only there             | one or more blocks               | none                           |
| `paragraph` | in `doc` or in `blockquote`          | `text` and `hardBreak`, optional | none                           |
| `heading`   | in `doc`                             | `text` and `hardBreak`, optional | `level`: `2` or `3` (required) |
| `blockquote`| in `doc`                             | one or more `paragraph`s         | none                           |
| `image`     | in `doc` (not in a blockquote)       | none                             | `src`, `alt` (both required)   |
| `text`      | in `paragraph` or `heading`          | `text`: a non-empty string       | `marks`, optional              |
| `hardBreak` | in `paragraph` or `heading`          | none                             | none                           |

Blocks are `paragraph`, `heading`, `blockquote` and `image`. Level 1 is kept for the page's own
title in the reader, so headings in the body start at 2.

### Marks

| Mark     | Renders as | Attributes |
| -------- | ---------- | ---------- |
| `bold`   | `<strong>` | none       |
| `italic` | `<em>`     | none       |

A text node's `marks` is a list like `[{ "type": "bold" }, { "type": "italic" }]`.

### Images

- `alt` is required: 1 to 250 characters, not only whitespace. It is what a screen reader reads.
- `src` is at most 1024 characters and must be a public URL of an object in our `page-images`
  storage bucket:

  ```
  <NEXT_PUBLIC_SUPABASE_URL origin>/storage/v1/object/public/page-images/<path>
  ```

  - Same origin (scheme, host and port) as `NEXT_PUBLIC_SUPABASE_URL`, over `http` or `https`.
  - `<path>` is one or more `/`-separated segments of `A-Z a-z 0-9 . _ -`, none starting with a
    dot (so no `.` or `..`), and no empty segments.
  - No credentials, query string or fragment, no percent-encoding, and written exactly as a URL
    parser would write it (lower-case scheme and host, no default port).
  - So `javascript:`, `data:`, protocol-relative (`//host/...`), relative and other-host URLs are
    all refused.

  The sanitiser and renderer take the storage URL as a parameter (`{ storageUrl }`), which callers
  read from `src/config`. The `page-images` bucket and its storage policies come with the
  image-upload story; this format only fixes the name and the path rule.

  Bodies store the full URL, as Tiptap's Image node does. Moving to another Supabase project would
  change the origin, so it would need a content migration that rewrites `src` in every body.

### Limits

| Limit                      | Value                                   | Where                                                         |
| -------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| Body size                  | 200000 bytes of `JSON.stringify`, UTF-8 | `PAGE_BODY_MAX_BYTES`, sanitiser and `pageBodySchema`         |
| Body size, database        | 300000 bytes of `body::text`            | `PAGE_BODY_DB_MAX_BYTES`, `pages_body_shape_check`            |
| Nesting                    | 16 levels of objects and arrays         | `PAGE_BODY_MAX_DEPTH` (valid bodies nest 9 deep at most)      |
| Image `alt`                | 250 characters                          | `IMAGE_ALT_MAX_LENGTH`                                        |
| Image `src`                | 1024 characters                         | `IMAGE_SRC_MAX_LENGTH`                                        |

The database limit is only a backstop and is looser on purpose: Postgres writes `body::text` with
a space after every `:` and `,`, so it measures a body 10–15% larger than `JSON.stringify` does.
The database also checks that `body` is an object whose `type` is `doc`.

## Sanitising: strip or reject

Every body from a client goes through `sanitisePageBody(input, { storageUrl })` in
`src/contracts/page-body` (the page input schemas in `src/contracts/page.ts` do this). It returns
`{ ok: true, body }`, where `body` always passes `pageBodySchema`, or `{ ok: false, code, path }`.

It **strips**, silently:

- unknown nodes (`script`, `iframe`, `codeBlock`, ...) with all their content;
- allowed nodes in the wrong place (text at the top level, an image or a blockquote inside a
  blockquote, a heading inside a paragraph), with their content;
- unknown marks (`link`, `underline`, ...), and repeated marks;
- unknown attributes and keys (`onclick`, `style`, `href`, `class`, `title`, ...);
- empty text nodes, and blockquotes left with no paragraphs.

It **normalises**:

- heading levels: 1 (or a missing or non-numeric level) becomes 2; 4 and above become 3;
- marks into the order `bold`, `italic`;
- text and alt text: NUL characters are removed and unpaired surrogates become U+FFFD, since
  Postgres `jsonb` can't store either;
- a doc left with no blocks becomes one empty paragraph.

It **rejects**, with one of these codes and the path of the problem (e.g.
`["content", 2, "attrs", "src"]`), rather than dropping a writer's content:

| Code                              | When                                                     |
| --------------------------------- | -------------------------------------------------------- |
| `page_body_not_a_document`        | the input isn't an object with `"type": "doc"`           |
| `page_body_too_deep`              | objects and arrays nest more than 16 levels deep         |
| `page_body_too_large`             | the cleaned body is over 200000 bytes                    |
| `page_body_image_src_not_allowed` | an image's `src` is missing or breaks the image URL rule |
| `page_body_image_alt_missing`     | an image's `alt` is missing, empty or only whitespace    |
| `page_body_image_alt_too_long`    | an image's `alt` is over 250 characters                  |

Text such as `<script>` inside a text node is just text: it is kept and escaped when rendered.

## Rendering

`renderPageBodyToHtml(body, { storageUrl })` returns an HTML string.

- It sanitises first. A body written straight to the table (PostgREST skips the server's checks)
  is treated as untrusted, and one the sanitiser rejects renders as an empty string.
- It emits only `<p>`, `<h2>`, `<h3>`, `<blockquote>`, `<br>`, `<strong>`, `<em>` and
  `<img src alt loading="lazy" decoding="async">`, with no other attributes.
- It escapes `&`, `<`, `>`, `"` and `'` in all text and attribute values.
- Marks nest in a fixed order, `<strong>` outside `<em>`.
- There is no wrapper element. The caller wraps the HTML and sets `lang` from the page's
  `language`, so Devanagari text gets Devanagari fonts.

## Examples

A Hindi page:

```json
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "बारिश का दिन" }] },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "आज सुबह से " },
        { "type": "text", "text": "बारिश", "marks": [{ "type": "bold" }] },
        { "type": "text", "text": " हो रही है।" },
        { "type": "hardBreak" },
        { "type": "text", "text": "चाय और किताब", "marks": [{ "type": "italic" }] },
        { "type": "text", "text": ", बस इतना काफ़ी है।" }
      ]
    },
    {
      "type": "blockquote",
      "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "मन के हारे हार है, मन के जीते जीत।" }] }]
    },
    { "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "खिड़की से" }] },
    {
      "type": "image",
      "attrs": {
        "src": "https://abcdefghijkl.supabase.co/storage/v1/object/public/page-images/5b3c1c1e/khidki.webp",
        "alt": "खिड़की के शीशे पर बारिश की बूँदें"
      }
    }
  ]
}
```

An English page:

```json
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "A rainy day" }] },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "It has been " },
        { "type": "text", "text": "raining", "marks": [{ "type": "bold" }] },
        { "type": "text", "text": " since morning." },
        { "type": "hardBreak" },
        { "type": "text", "text": "Tea and a book", "marks": [{ "type": "bold" }, { "type": "italic" }] },
        { "type": "text", "text": " are enough." }
      ]
    },
    {
      "type": "blockquote",
      "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "The mind that wins, wins." }] }]
    },
    { "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "From the window" }] },
    {
      "type": "image",
      "attrs": {
        "src": "https://abcdefghijkl.supabase.co/storage/v1/object/public/page-images/5b3c1c1e/window.webp",
        "alt": "Raindrops on a window pane"
      }
    }
  ]
}
```

`https://abcdefghijkl.supabase.co` stands for the project's `NEXT_PUBLIC_SUPABASE_URL`.
