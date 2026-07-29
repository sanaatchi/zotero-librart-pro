// @ajan: cursor · @etiket: f3, vitest, docx-cited
import { describe, expect, it } from "vitest";
import {
  buildCitedTag,
  combineInstrTextRuns,
  extractCitationUrisFromDocumentXml,
  extractBalancedJson,
  unescapeXml,
} from "../src/utils/docxCitedParse";

const SAMPLE_XML = `
<w:document>
  <w:body>
    <w:p>
      <w:r><w:instrText> ADDIN ZOTERO_ITEM CSL_CITATION </w:instrText></w:r>
      <w:r><w:instrText>{"citationItems":[{"uris":["http://zotero.org/users/1/items/ABC123"]}],"properties":{}}</w:instrText></w:r>
    </w:p>
  </w:body>
</w:document>`;

describe("docxCitedParse", () => {
  it("unescapes XML entities", () => {
    expect(unescapeXml("&lt;tag&gt;")).toBe("<tag>");
  });

  it("extracts balanced JSON respecting strings", () => {
    const text = 'prefix {"a":"{not brace}"} suffix';
    const start = text.indexOf("{");
    expect(extractBalancedJson(text, start)).toBe('{"a":"{not brace}"}');
  });

  it("combines instrText runs", () => {
    const combined = combineInstrTextRuns(SAMPLE_XML);
    expect(combined).toContain("CSL_CITATION");
    expect(combined).toContain("citationItems");
  });

  it("extracts Zotero URIs from document xml", () => {
    const uris = extractCitationUrisFromDocumentXml(SAMPLE_XML);
    expect(uris).toEqual(["http://zotero.org/users/1/items/ABC123"]);
  });

  it("builds cited tag with prefix", () => {
    expect(buildCitedTag("ms2")).toBe("cited:ms2");
    expect(buildCitedTag("cited:draft")).toBe("cited:draft");
  });
});
