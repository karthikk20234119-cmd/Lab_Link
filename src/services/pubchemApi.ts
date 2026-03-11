/**
 * PubChem API Service
 * Fetches Safety Data Sheets (SDS) and hazard information from PubChem's REST API.
 * Uses CAS number or chemical name to look up compound data.
 * Docs: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 */

const PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const PUBCHEM_VIEW = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view";

export interface PubChemSafetyData {
  cid: number;
  iupacName: string;
  molecularFormula: string;
  molecularWeight: string;
  ghs: GHSInfo;
  hazardStatements: string[];
  precautionaryStatements: string[];
  signalWord: string;
  sdsUrl: string;
  pubchemUrl: string;
  pictograms: string[];
}

export interface GHSInfo {
  pictograms: string[];
  signalWord: string;
}

/**
 * Look up a PubChem Compound ID (CID) by CAS number.
 */
async function getCidByCas(casNumber: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${PUBCHEM_BASE}/compound/name/${encodeURIComponent(casNumber)}/cids/JSON`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.IdentifierList?.CID?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Look up CID by chemical name (fallback if CAS lookup fails).
 */
async function getCidByName(name: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${PUBCHEM_BASE}/compound/name/${encodeURIComponent(name)}/cids/JSON`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.IdentifierList?.CID?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Get compound properties from PubChem by CID.
 */
async function getCompoundProperties(cid: number) {
  try {
    const res = await fetch(
      `${PUBCHEM_BASE}/compound/cid/${cid}/property/IUPACName,MolecularFormula,MolecularWeight/JSON`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.PropertyTable?.Properties?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Extract GHS hazard data from PubChem PUG View by CID.
 */
async function getGHSData(cid: number) {
  try {
    const res = await fetch(
      `${PUBCHEM_VIEW}/data/compound/${cid}/JSON?heading=GHS+Classification`,
    );
    if (!res.ok) return null;
    const data = await res.json();

    const hazardStatements: string[] = [];
    const precautionaryStatements: string[] = [];
    const pictograms: string[] = [];
    let signalWord = "";

    // Traverse the deeply nested PubChem response structure
    const sections = data?.Record?.Section || [];
    for (const section of sections) {
      const subSections = section?.Section || [];
      for (const sub of subSections) {
        const innerSections = sub?.Section || [];
        for (const inner of innerSections) {
          const heading = inner?.TOCHeading || "";

          if (heading === "GHS Hazard Statements") {
            for (const info of inner?.Information || []) {
              for (const val of info?.Value?.StringWithMarkup || []) {
                if (val?.String) hazardStatements.push(val.String);
              }
            }
          }

          if (heading === "Precautionary Statement Codes") {
            for (const info of inner?.Information || []) {
              for (const val of info?.Value?.StringWithMarkup || []) {
                if (val?.String) precautionaryStatements.push(val.String);
              }
            }
          }

          if (heading === "Pictogram(s)") {
            for (const info of inner?.Information || []) {
              for (const val of info?.Value?.StringWithMarkup || []) {
                for (const markup of val?.Markup || []) {
                  if (markup?.URL) pictograms.push(markup.URL);
                }
              }
            }
          }

          if (heading === "Signal") {
            for (const info of inner?.Information || []) {
              for (const val of info?.Value?.StringWithMarkup || []) {
                if (val?.String) signalWord = val.String;
              }
            }
          }
        }
      }
    }

    return {
      hazardStatements,
      precautionaryStatements,
      pictograms,
      signalWord,
    };
  } catch {
    return null;
  }
}

/**
 * Main entry: fetch the full SDS-like safety data for a chemical.
 * @param casNumber - The CAS registry number (e.g., "7647-14-5")
 * @param chemicalName - The chemical name as fallback (e.g., "Sodium Chloride")
 */
export async function fetchSafetyDataSheet(
  casNumber?: string | null,
  chemicalName?: string | null,
): Promise<PubChemSafetyData | null> {
  // Try CAS first, then name
  let cid: number | null = null;
  if (casNumber) cid = await getCidByCas(casNumber);
  if (!cid && chemicalName) cid = await getCidByName(chemicalName);
  if (!cid) return null;

  // Fetch properties and GHS data in parallel
  const [properties, ghsData] = await Promise.all([
    getCompoundProperties(cid),
    getGHSData(cid),
  ]);

  const deduped = (arr: string[]) => [...new Set(arr)];

  return {
    cid,
    iupacName: properties?.IUPACName || "",
    molecularFormula: properties?.MolecularFormula || "",
    molecularWeight: properties?.MolecularWeight || "",
    ghs: {
      pictograms: deduped(ghsData?.pictograms || []),
      signalWord: ghsData?.signalWord || "Not classified",
    },
    hazardStatements: deduped(ghsData?.hazardStatements || []),
    precautionaryStatements: deduped(ghsData?.precautionaryStatements || []),
    signalWord: ghsData?.signalWord || "Not classified",
    sdsUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Safety-and-Hazards`,
    pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
    pictograms: deduped(ghsData?.pictograms || []),
  };
}
