import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Check,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  CirclePlus,
  ArrowUpDown,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Globe,
  Sparkles,
  Building2,
  ImageIcon,
  Plus,
  X,
  Eye,
  Search,
  CheckSquare,
} from "lucide-react";
import * as XLSX from "xlsx";

// ─── Mappable DB fields ──────────────────────────────────────────────────────
const DB_FIELDS = [
  // Core
  { key: "name", label: "Item Name", required: true, group: "Core" },
  { key: "description", label: "Description", required: false, group: "Core" },
  { key: "item_code", label: "Item Code", required: false, group: "Core" },
  {
    key: "serial_number",
    label: "Serial Number",
    required: false,
    group: "Core",
  },
  { key: "asset_tag", label: "Asset Tag", required: false, group: "Core" },
  { key: "barcode", label: "Barcode", required: false, group: "Core" },
  { key: "item_type", label: "Item Type", required: false, group: "Core" },
  {
    key: "model_number",
    label: "Model Number",
    required: false,
    group: "Core",
  },
  { key: "brand", label: "Brand", required: false, group: "Core" },
  { key: "unit", label: "Unit", required: false, group: "Core" },
  // Quantity & Status
  {
    key: "current_quantity",
    label: "Quantity",
    required: false,
    group: "Quantity",
  },
  {
    key: "reorder_threshold",
    label: "Reorder Threshold",
    required: false,
    group: "Quantity",
  },
  { key: "status", label: "Status", required: false, group: "Quantity" },
  { key: "condition", label: "Condition", required: false, group: "Quantity" },
  {
    key: "is_borrowable",
    label: "Is Borrowable",
    required: false,
    group: "Quantity",
  },
  // Location
  {
    key: "storage_location",
    label: "Storage Location",
    required: false,
    group: "Location",
  },
  {
    key: "lab_location",
    label: "Lab Location",
    required: false,
    group: "Location",
  },
  {
    key: "shelf_location",
    label: "Shelf Location",
    required: false,
    group: "Location",
  },
  // Procurement
  {
    key: "purchase_price",
    label: "Purchase Price",
    required: false,
    group: "Procurement",
  },
  {
    key: "purchase_date",
    label: "Purchase Date",
    required: false,
    group: "Procurement",
  },
  {
    key: "supplier_name",
    label: "Supplier Name",
    required: false,
    group: "Procurement",
  },
  {
    key: "supplier_contact",
    label: "Supplier Contact",
    required: false,
    group: "Procurement",
  },
  {
    key: "invoice_reference",
    label: "Invoice Reference",
    required: false,
    group: "Procurement",
  },
  {
    key: "warranty_until",
    label: "Warranty Until",
    required: false,
    group: "Procurement",
  },
  // Safety
  {
    key: "safety_level",
    label: "Safety Level",
    required: false,
    group: "Safety",
  },
  {
    key: "hazard_type",
    label: "Hazard Type",
    required: false,
    group: "Safety",
  },
  // Electrical
  {
    key: "power_rating",
    label: "Power Rating",
    required: false,
    group: "Electrical",
  },
  { key: "voltage", label: "Voltage", required: false, group: "Electrical" },
  // Maintenance
  {
    key: "maintenance_interval_days",
    label: "Maintenance Interval (days)",
    required: false,
    group: "Maintenance",
  },
  {
    key: "expiry_date",
    label: "Expiry Date",
    required: false,
    group: "Maintenance",
  },
  // Other
  { key: "notes", label: "Notes", required: false, group: "Other" },
] as const;

// ─── Fuzzy aliases for auto-detect ───────────────────────────────────────────
const FIELD_ALIASES: Record<string, string[]> = {
  name: [
    "item name",
    "product name",
    "name",
    "title",
    "item",
    "equipment",
    "equipment name",
  ],
  description: ["description", "desc", "details"],
  item_code: ["item code", "code", "sku", "product code", "item_code"],
  serial_number: ["serial", "serial number", "serial_number", "sn", "s/n"],
  asset_tag: ["asset tag", "asset_tag", "asset id", "tag"],
  barcode: ["barcode", "bar code", "upc", "ean"],
  item_type: ["item type", "item_type", "type", "category"],
  model_number: [
    "model",
    "model number",
    "model_number",
    "catalog number",
    "catalog_number",
    "cat no",
    "part number",
    "part_number",
  ],
  brand: ["brand", "manufacturer", "make"],
  unit: ["unit", "uom", "unit of measure"],
  current_quantity: [
    "quantity",
    "qty",
    "count",
    "amount",
    "current_quantity",
    "stock",
  ],
  reorder_threshold: [
    "reorder",
    "reorder threshold",
    "reorder_threshold",
    "min stock",
    "minimum",
  ],
  status: ["status", "state"],
  condition: ["condition"],
  is_borrowable: ["borrowable", "is_borrowable", "can borrow"],
  storage_location: [
    "location",
    "storage",
    "storage_location",
    "room",
    "shelf",
  ],
  lab_location: ["lab", "lab location", "lab_location", "laboratory"],
  shelf_location: ["shelf", "shelf_location", "rack", "bin"],
  purchase_price: [
    "price",
    "cost",
    "purchase price",
    "purchase_price",
    "value",
  ],
  purchase_date: [
    "purchase date",
    "purchase_date",
    "date purchased",
    "acquired",
  ],
  supplier_name: ["supplier", "vendor", "supplier_name"],
  supplier_contact: [
    "supplier contact",
    "supplier_contact",
    "vendor contact",
    "vendor email",
  ],
  invoice_reference: [
    "invoice",
    "invoice_reference",
    "invoice number",
    "po number",
  ],
  warranty_until: [
    "warranty",
    "warranty_until",
    "warranty end",
    "warranty date",
  ],
  safety_level: ["safety", "safety level", "safety_level", "hazard level"],
  hazard_type: ["hazard", "hazard type", "hazard_type"],
  power_rating: ["power", "wattage", "power_rating"],
  voltage: ["voltage", "volts", "v"],
  maintenance_interval_days: [
    "maintenance interval",
    "maintenance_interval_days",
    "service interval",
  ],
  expiry_date: ["expiry", "expiry_date", "expiration", "expires"],
  notes: ["notes", "remarks", "comments", "memo"],
};

// Allowed enum values
const VALID_STATUSES = [
  "available",
  "borrowed",
  "under_maintenance",
  "damaged",
  "archived",
];
const VALID_SAFETY_LEVELS = ["low", "medium", "high", "hazardous"];

// ─── Local enrichment heuristics ─────────────────────────────────────────────
const ITEM_TYPE_KEYWORDS: Record<string, string[]> = {
  Equipment: [
    "oscilloscope",
    "multimeter",
    "generator",
    "analyzer",
    "scope",
    "spectrometer",
    "microscope",
    "centrifuge",
    "autoclave",
    "incubator",
    "printer",
    "scanner",
    "projector",
    "monitor",
    "computer",
    "laptop",
    "power supply",
  ],
  Glassware: [
    "beaker",
    "flask",
    "test tube",
    "pipette",
    "burette",
    "funnel",
    "petri dish",
    "graduated cylinder",
    "volumetric",
    "erlenmeyer",
    "condenser",
    "watch glass",
  ],
  Chemical: [
    "acid",
    "base",
    "solvent",
    "reagent",
    "solution",
    "compound",
    "ethanol",
    "methanol",
    "acetone",
    "chloroform",
    "sulfuric",
    "hydrochloric",
    "indicator",
    "buffer",
  ],
  "Measuring Instrument": [
    "caliper",
    "micrometer",
    "gauge",
    "thermometer",
    "hygrometer",
    "barometer",
    "scale",
    "balance",
    "weighing",
    "ph meter",
  ],
  "Safety Equipment": [
    "goggles",
    "gloves",
    "lab coat",
    "face shield",
    "respirator",
    "fire extinguisher",
    "fume hood",
    "ppe",
  ],
  Tool: [
    "wrench",
    "screwdriver",
    "plier",
    "hammer",
    "drill",
    "saw",
    "cutter",
    "soldering",
    "wire stripper",
    "clamp",
  ],
  Consumable: [
    "filter paper",
    "litmus",
    "tape",
    "wire",
    "cable",
    "resistor",
    "capacitor",
    "led",
    "transistor",
    "diode",
    "fuse",
    "battery",
    "solder",
  ],
  Furniture: [
    "table",
    "chair",
    "desk",
    "cabinet",
    "shelf",
    "rack",
    "stool",
    "workbench",
    "whiteboard",
  ],
};

const SAFETY_KEYWORDS: Record<string, string[]> = {
  hazardous: [
    "radioactive",
    "biohazard",
    "carcinogen",
    "explosive",
    "cyanide",
    "mercury",
  ],
  high: [
    "acid",
    "corrosive",
    "flammable",
    "oxidizer",
    "toxic",
    "concentrated",
    "hazardous",
    "dangerous",
  ],
  medium: [
    "laser",
    "high voltage",
    "uv",
    "compressed gas",
    "centrifuge",
    "autoclave",
    "solvent",
    "electrical",
    "heavy",
  ],
};

function inferItemType(name: string, desc?: string): string | null {
  const text = `${name} ${desc || ""}`.toLowerCase();
  for (const [type, kws] of Object.entries(ITEM_TYPE_KEYWORDS)) {
    if (kws.some((kw) => text.includes(kw))) return type;
  }
  return null;
}

function inferSafetyLevel(name: string, desc?: string): string | null {
  const text = `${name} ${desc || ""}`.toLowerCase();
  for (const level of ["hazardous", "high", "medium"] as const) {
    if (SAFETY_KEYWORDS[level].some((kw) => text.includes(kw))) return level;
  }
  return "low";
}

function generateItemCode(name: string, index: number): string {
  const words = name.trim().split(/\s+/);
  const prefix =
    words.length >= 2
      ? (words[0][0] + words[1][0] + (words[0][1] || "")).toUpperCase()
      : name.slice(0, 3).toUpperCase();
  return `${prefix}-${String(index + 1).padStart(3, "0")}`;
}

function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.some((a) => normalized === a || normalized.includes(a))) {
        if (!Object.values(mapping).includes(field)) {
          mapping[header] = field;
          break;
        }
      }
    }
  }
  return mapping;
}

// ─── Template download ───────────────────────────────────────────────────────
function downloadTemplate() {
  const headerRow = DB_FIELDS.map((f) => f.label);
  const exampleRow1 = [
    "Digital Oscilloscope",
    "4-channel 200MHz scope",
    "OSC-001",
    "SN-2024-001",
    "AT-1001",
    "9781234567890",
    "Equipment",
    "TBS2000B",
    "Tektronix",
    "pcs",
    "5",
    "2",
    "available",
    "good",
    "true",
    "Room 205 Cabinet A",
    "Electronics Lab",
    "Shelf B3",
    "45000",
    "2024-01-15",
    "SciEquip Ltd",
    "contact@sciequip.com",
    "INV-2024-0042",
    "2027-01-15",
    "medium",
    "",
    "100W",
    "220V",
    "180",
    "",
    "Calibrated quarterly",
  ];
  const exampleRow2 = [
    "Beaker 500ml",
    "Borosilicate glass beaker",
    "BKR-500",
    "",
    "",
    "",
    "Glassware",
    "",
    "Borosil",
    "pcs",
    "25",
    "10",
    "available",
    "new",
    "true",
    "Lab Store Room 1",
    "Chemistry Lab",
    "Shelf A1",
    "350",
    "2024-06-01",
    "Lab Supplies Inc",
    "",
    "",
    "",
    "low",
    "corrosive",
    "",
    "",
    "",
    "2026-12-31",
    "",
  ];

  const ws = XLSX.utils.aoa_to_sheet([headerRow, exampleRow1, exampleRow2]);
  // Set column widths
  ws["!cols"] = headerRow.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "LabLink Import Template");
  XLSX.writeFile(wb, "LabLink_Import_Template.xlsx");
}

// ─── Types ───────────────────────────────────────────────────────────────────
type ImportMode = "insert" | "upsert";
type RowStatus = "new" | "update" | "duplicate" | "error";

interface RowMeta {
  status: RowStatus;
  message?: string;
}

interface BulkImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  onImportComplete: () => void;
}

type Step = "upload" | "map" | "enrich" | "preview" | "import";

export function BulkImportWizard({
  open,
  onOpenChange,
  departmentId,
  onImportComplete,
}: BulkImportWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(
    {},
  );
  const [errors, setErrors] = useState<Array<{ row: number; message: string }>>(
    [],
  );
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    inserted: number;
    updated: number;
    skipped: number;
    failed: number;
    failedRows: Array<{ row: number; error: string }>;
  }>({ inserted: 0, updated: 0, skipped: 0, failed: 0, failedRows: [] });
  const [dragActive, setDragActive] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("insert");
  const [rowMeta, setRowMeta] = useState<RowMeta[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  // ─── New state for department selector, enrichment, and auth ────────────
  const [departments, setDepartments] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(
    departmentId || "",
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichedFields, setEnrichedFields] = useState<
    Record<number, Record<string, { value: any; source: string }>>
  >({});
  const [enrichmentDone, setEnrichmentDone] = useState(false);
  // Per-item enrichment progress
  const [enrichProgress, setEnrichProgress] = useState({
    current: 0,
    total: 0,
  });
  // Per-item image search status from edge function
  const [imageSearchStatus, setImageSearchStatus] = useState<
    Record<number, "found" | "partial" | "not_found">
  >({});
  // Per-item selected images: { idx: [{url, source, width?, height?}] }
  const [selectedImages, setSelectedImages] = useState<
    Record<
      number,
      Array<{ url: string; source: string; width?: number; height?: number }>
    >
  >({});
  const [manualImageUrl, setManualImageUrl] = useState<Record<number, string>>(
    {},
  );

  // Fetch departments and current user on mount
  useEffect(() => {
    const init = async () => {
      const { data: depts } = await supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true);
      if (depts) setDepartments(depts);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    if (open) init();
  }, [open]);

  // Sync departmentId prop
  useEffect(() => {
    if (departmentId && !selectedDepartmentId)
      setSelectedDepartmentId(departmentId);
  }, [departmentId]);

  const reset = () => {
    setStep("upload");
    setRawData([]);
    setHeaders([]);
    setColumnMapping({});
    setErrors([]);
    setImportProgress(0);
    setIsImporting(false);
    setImportResults({
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      failedRows: [],
    });
    setImportMode("insert");
    setRowMeta([]);
    setEnrichedFields({});
    setEnrichmentDone(false);
    setIsEnriching(false);
    setSelectedImages({});
    setManualImageUrl({});
  };

  // ─── File Handling ───────────────────────────────────────────────────────
  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

          if (jsonData.length === 0) {
            toast({
              variant: "destructive",
              title: "Empty File",
              description: "The uploaded file contains no data rows.",
            });
            return;
          }

          const fileHeaders = Object.keys(jsonData[0]);
          setHeaders(fileHeaders);
          setRawData(jsonData);
          setColumnMapping(autoDetectMapping(fileHeaders));
          setStep("map");

          toast({
            title: "File Parsed",
            description: `Found ${jsonData.length} rows and ${fileHeaders.length} columns.`,
          });
        } catch (err: any) {
          toast({
            variant: "destructive",
            title: "Parse Error",
            description: err.message,
          });
        }
      };
      reader.readAsBinaryString(file);
    },
    [toast],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // ─── Validation ──────────────────────────────────────────────────────────
  const validateData = (): Array<{ row: number; message: string }> => {
    const validationErrors: Array<{ row: number; message: string }> = [];
    const nameField = Object.entries(columnMapping).find(
      ([, v]) => v === "name",
    )?.[0];

    if (!nameField) {
      validationErrors.push({
        row: 0,
        message: "Required field 'Item Name' is not mapped to any column.",
      });
      return validationErrors;
    }

    const seenCodes = new Set<string>();
    const statusField = Object.entries(columnMapping).find(
      ([, v]) => v === "status",
    )?.[0];
    const safetyField = Object.entries(columnMapping).find(
      ([, v]) => v === "safety_level",
    )?.[0];
    const qtyField = Object.entries(columnMapping).find(
      ([, v]) => v === "current_quantity",
    )?.[0];
    const priceField = Object.entries(columnMapping).find(
      ([, v]) => v === "purchase_price",
    )?.[0];

    rawData.forEach((row, idx) => {
      const rowNum = idx + 2;

      // Required: name
      if (!row[nameField] || String(row[nameField]).trim() === "") {
        validationErrors.push({
          row: rowNum,
          message: "Missing required field: Item Name",
        });
      }

      // Duplicate item_code within file
      const codeField = Object.entries(columnMapping).find(
        ([, v]) => v === "item_code",
      )?.[0];
      if (codeField && row[codeField]) {
        const code = String(row[codeField]).trim();
        if (seenCodes.has(code)) {
          validationErrors.push({
            row: rowNum,
            message: `Duplicate item code in file: ${code}`,
          });
        }
        seenCodes.add(code);
      }

      // Validate status enum
      if (statusField && row[statusField]) {
        const val = String(row[statusField]).trim().toLowerCase();
        if (val && !VALID_STATUSES.includes(val)) {
          validationErrors.push({
            row: rowNum,
            message: `Invalid status "${row[statusField]}". Expected: ${VALID_STATUSES.join(", ")}`,
          });
        }
      }

      // Validate safety_level enum
      if (safetyField && row[safetyField]) {
        const val = String(row[safetyField]).trim().toLowerCase();
        if (val && !VALID_SAFETY_LEVELS.includes(val)) {
          validationErrors.push({
            row: rowNum,
            message: `Invalid safety level "${row[safetyField]}". Expected: ${VALID_SAFETY_LEVELS.join(", ")}`,
          });
        }
      }

      // Validate numeric: quantity
      if (qtyField && row[qtyField] !== "" && row[qtyField] != null) {
        const parsed = Number(row[qtyField]);
        if (isNaN(parsed) || parsed < 0) {
          validationErrors.push({
            row: rowNum,
            message: `Invalid quantity: "${row[qtyField]}"`,
          });
        }
      }

      // Validate numeric: price
      if (priceField && row[priceField] !== "" && row[priceField] != null) {
        const parsed = Number(row[priceField]);
        if (isNaN(parsed) || parsed < 0) {
          validationErrors.push({
            row: rowNum,
            message: `Invalid price: "${row[priceField]}"`,
          });
        }
      }
    });

    return validationErrors;
  };

  // ─── Chunked query helper (avoids URL length limits on .in()) ─────────
  const queryInChunks = async (
    column: string,
    values: string[],
    chunkSize = 100,
  ): Promise<Set<string>> => {
    const result = new Set<string>();
    for (let i = 0; i < values.length; i += chunkSize) {
      const chunk = values.slice(i, i + chunkSize);
      const { data, error } = await (supabase.from("items") as any)
        .select(column)
        .in(column, chunk);
      if (error) {
        console.error(`queryInChunks error for ${column}:`, error.message);
        continue;
      }
      if (data) {
        data.forEach((d: any) => {
          if (d[column]) result.add(String(d[column]).trim());
        });
      }
    }
    console.log(
      `queryInChunks(${column}): found ${result.size} existing matches out of ${values.length} values`,
    );
    return result;
  };

  // ─── Duplicate Detection ─────────────────────────────────────────────────
  const checkDuplicates = async () => {
    setIsCheckingDuplicates(true);
    try {
      const codeField = Object.entries(columnMapping).find(
        ([, v]) => v === "item_code",
      )?.[0];
      const serialField = Object.entries(columnMapping).find(
        ([, v]) => v === "serial_number",
      )?.[0];

      console.log("checkDuplicates: columnMapping =", columnMapping);
      console.log(
        "checkDuplicates: codeField =",
        codeField,
        ", serialField =",
        serialField,
      );

      // Collect codes and serials from file
      const fileCodes: string[] = [];
      const fileSerials: string[] = [];

      rawData.forEach((row) => {
        if (codeField && row[codeField] != null && row[codeField] !== "") {
          const v = String(row[codeField]).trim();
          if (v && !fileCodes.includes(v)) fileCodes.push(v);
        }
        if (
          serialField &&
          row[serialField] != null &&
          row[serialField] !== ""
        ) {
          const v = String(row[serialField]).trim();
          if (v && !fileSerials.includes(v)) fileSerials.push(v);
        }
      });

      console.log(
        `checkDuplicates: collected ${fileCodes.length} item_codes, ${fileSerials.length} serial_numbers from file`,
      );

      // Query existing items in chunks
      const existingCodes =
        fileCodes.length > 0
          ? await queryInChunks("item_code", fileCodes)
          : new Set<string>();
      const existingSerials =
        fileSerials.length > 0
          ? await queryInChunks("serial_number", fileSerials)
          : new Set<string>();

      console.log(
        `checkDuplicates: ${existingCodes.size} existing codes, ${existingSerials.size} existing serials found in DB`,
      );

      // Build per-row metadata
      const meta: RowMeta[] = rawData.map((row) => {
        const code =
          codeField && row[codeField] ? String(row[codeField]).trim() : "";
        const serial =
          serialField && row[serialField]
            ? String(row[serialField]).trim()
            : "";
        const codeMatch = code && existingCodes.has(code);
        const serialMatch = serial && existingSerials.has(serial);

        if (codeMatch || serialMatch) {
          if (importMode === "upsert") {
            return {
              status: "update" as RowStatus,
              message: `Match: ${codeMatch ? `item_code=${code}` : `serial=${serial}`}`,
            };
          }
          return {
            status: "duplicate" as RowStatus,
            message: `Exists: ${codeMatch ? `item_code=${code}` : `serial=${serial}`}`,
          };
        }
        return { status: "new" as RowStatus };
      });

      const newCount = meta.filter((m) => m.status === "new").length;
      const dupCount = meta.filter((m) => m.status === "duplicate").length;
      const updCount = meta.filter((m) => m.status === "update").length;
      console.log(
        `checkDuplicates result: ${newCount} new, ${dupCount} duplicate, ${updCount} update`,
      );

      setRowMeta(meta);
    } catch (err: any) {
      console.error("Duplicate check error:", err?.message || err);
      toast({
        variant: "destructive",
        title: "Duplicate Check Failed",
        description:
          "Could not check for existing items. You can still import — duplicates will be skipped.",
      });
      // If detection fails, mark all as new and let the import handle conflicts
      setRowMeta(rawData.map(() => ({ status: "new" as RowStatus })));
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const goToEnrich = () => {
    const validationErrors = validateData();
    setErrors(validationErrors);
    setEnrichmentDone(false);
    setEnrichedFields({});
    setStep("enrich");
  };

  const goToPreview = async () => {
    setStep("preview");
    await checkDuplicates();
  };

  // ─── Online Enrichment via Edge Function ─────────────────────────────
  const handleEnrich = async () => {
    setIsEnriching(true);
    const newEnriched: Record<
      number,
      Record<string, { value: any; source: string }>
    > = {};

    // Find which fields each row is missing
    const nameField = Object.entries(columnMapping).find(
      ([, v]) => v === "name",
    )?.[0];
    const descField = Object.entries(columnMapping).find(
      ([, v]) => v === "description",
    )?.[0];
    const brandField = Object.entries(columnMapping).find(
      ([, v]) => v === "brand",
    )?.[0];
    const codeField = Object.entries(columnMapping).find(
      ([, v]) => v === "item_code",
    )?.[0];
    const modelField = Object.entries(columnMapping).find(
      ([, v]) => v === "model_number",
    )?.[0];

    // Collect items needing enrichment
    const itemsToEnrich: Array<{
      idx: number;
      name: string;
      brand?: string;
      catalog_number?: string;
    }> = [];
    rawData.forEach((row, idx) => {
      const name = nameField ? String(row[nameField] || "").trim() : "";
      if (!name) return;
      const desc = descField ? String(row[descField] || "").trim() : "";
      const hasCode = codeField ? String(row[codeField] || "").trim() : "";
      if (!desc || !hasCode) {
        itemsToEnrich.push({
          idx,
          name,
          brand: brandField ? String(row[brandField] || "").trim() : undefined,
          catalog_number: modelField
            ? String(row[modelField] || "").trim()
            : undefined,
        });
      }
    });
    setEnrichProgress({ current: 0, total: itemsToEnrich.length });

    try {
      // Try Edge Function first
      let onlineResults: any[] = [];
      try {
        const { data, error } = await supabase.functions.invoke(
          "enrich-items",
          {
            body: {
              items: itemsToEnrich.map((i) => ({
                name: i.name,
                brand: i.brand,
                catalog_number: i.catalog_number,
              })),
            },
          },
        );
        if (!error && data?.results) {
          onlineResults = data.results;
        }
      } catch {
        console.log("Edge Function unavailable, using local heuristics only");
      }

      // Apply enrichments
      const newSelectedImages: Record<
        number,
        Array<{ url: string; source: string; width?: number; height?: number }>
      > = {};
      const newImageSearchStatus: Record<
        number,
        "found" | "partial" | "not_found"
      > = {};
      itemsToEnrich.forEach((item, i) => {
        setEnrichProgress({ current: i + 1, total: itemsToEnrich.length });
        const online = onlineResults[i];
        const enrichments: Record<string, { value: any; source: string }> = {};
        const desc = descField
          ? String(rawData[item.idx][descField] || "").trim()
          : "";
        const code = codeField
          ? String(rawData[item.idx][codeField] || "").trim()
          : "";

        // Description
        if (!desc && online?.description) {
          enrichments.description = {
            value: online.description.slice(0, 500),
            source: online.source || "online",
          };
        }

        // Primary image
        if (online?.image_url) {
          enrichments.image_url = {
            value: online.image_url,
            source: online.source || "online",
          };
        }

        // Multiple images — now stored as rich objects {url, source, width?, height?}
        if (online?.image_urls && online.image_urls.length > 0) {
          // image_urls comes as array of {url, source, width?, height?} from edge func
          const allImgs = online.image_urls.map((img: any) =>
            typeof img === "string"
              ? { url: img, source: online.source || "online" }
              : {
                  url: img.url,
                  source: img.source || "online",
                  width: img.width,
                  height: img.height,
                },
          );
          enrichments.all_images = {
            value: allImgs,
            source: online.source || "online",
          };
          // Auto-select all fetched images
          newSelectedImages[item.idx] = allImgs;
          if (allImgs.length > 1) {
            enrichments.sub_images = {
              value: allImgs.slice(1).map((img: any) => img.url),
              source: online.source || "online",
            };
          }
        }

        // Track image search status
        newImageSearchStatus[item.idx] =
          online?.image_search_status ||
          (online?.image_urls?.length >= 5
            ? "found"
            : online?.image_urls?.length > 0
              ? "partial"
              : "not_found");

        // Suggested quantity
        if (online?.suggested_quantity && online.suggested_quantity > 1) {
          enrichments.current_quantity = {
            value: online.suggested_quantity,
            source: "heuristic",
          };
        }

        // Item code (auto-generate if missing)
        if (!code) {
          enrichments.item_code = {
            value: generateItemCode(item.name, item.idx),
            source: "auto",
          };
        }

        // Item type
        const inferredType =
          online?.item_type || inferItemType(item.name, online?.description);
        if (inferredType) {
          enrichments.item_type = {
            value: inferredType,
            source: online?.item_type ? "online" : "heuristic",
          };
        }

        // Safety level
        const inferredSafety =
          online?.safety_level ||
          inferSafetyLevel(item.name, online?.description);
        if (inferredSafety) {
          enrichments.safety_level = {
            value: inferredSafety,
            source: online?.safety_level ? "online" : "heuristic",
          };
        }

        if (Object.keys(enrichments).length > 0) {
          newEnriched[item.idx] = enrichments;
        }
      });

      setEnrichedFields(newEnriched);
      setSelectedImages(newSelectedImages);
      setImageSearchStatus(newImageSearchStatus);
      setEnrichmentDone(true);

      const totalEnriched = Object.keys(newEnriched).length;
      const descs = Object.values(newEnriched).filter(
        (e) => e.description,
      ).length;
      const imgs = Object.values(newEnriched).filter((e) => e.image_url).length;
      const multiImgs = Object.values(newEnriched).filter(
        (e) => e.sub_images,
      ).length;
      toast({
        title: "Enrichment Complete",
        description: `${totalEnriched} items enriched: ${descs} descriptions, ${imgs} images (${multiImgs} with multiple).`,
      });
    } catch (err: any) {
      console.error("Enrichment error:", err);
      toast({
        variant: "destructive",
        title: "Enrichment Failed",
        description: err?.message || "Could not enrich items.",
      });
    } finally {
      setIsEnriching(false);
    }
  };

  // ─── Build mapped rows ───────────────────────────────────────────────────
  const buildMappedRow = (row: any, rowIdx: number): Record<string, any> => {
    const mapped: Record<string, any> = {
      department_id: selectedDepartmentId || departmentId,
      ...(currentUserId ? { created_by: currentUserId } : {}),
    };
    for (const [sourceCol, targetField] of Object.entries(columnMapping)) {
      if (targetField && targetField !== "skip") {
        let value = row[sourceCol];
        // Type coercion
        if (
          targetField === "current_quantity" ||
          targetField === "reorder_threshold" ||
          targetField === "maintenance_interval_days"
        ) {
          value =
            parseInt(value) ||
            (targetField === "current_quantity"
              ? 1
              : targetField === "reorder_threshold"
                ? 1
                : null);
        } else if (targetField === "purchase_price") {
          value = parseFloat(value) || null;
        } else if (targetField === "is_borrowable") {
          const str = String(value || "")
            .trim()
            .toLowerCase();
          value =
            str === "true" || str === "yes" || str === "1"
              ? true
              : str === "false" || str === "no" || str === "0"
                ? false
                : null;
        } else if (targetField === "status") {
          const str = String(value || "")
            .trim()
            .toLowerCase();
          value = VALID_STATUSES.includes(str) ? str : null;
        } else if (targetField === "safety_level") {
          const str = String(value || "")
            .trim()
            .toLowerCase();
          value = VALID_SAFETY_LEVELS.includes(str) ? str : null;
        } else {
          value = String(value || "").trim() || null;
        }
        mapped[targetField] = value;
      }
    }

    // Apply enriched data (from online/heuristic enrichment)
    const rowEnrichments = enrichedFields[rowIdx];
    if (rowEnrichments) {
      for (const [field, enrichment] of Object.entries(rowEnrichments)) {
        // Skip image fields — we handle them from selectedImages below
        if (
          field === "image_url" ||
          field === "sub_images" ||
          field === "all_images"
        )
          continue;
        if (!mapped[field] || mapped[field] === null || mapped[field] === "") {
          mapped[field] = enrichment.value;
        }
      }
    }

    // Apply selected images from the gallery UI
    const rowImages = selectedImages[rowIdx];
    if (rowImages && rowImages.length > 0) {
      mapped.image_url = rowImages[0].url;
      if (rowImages.length > 1) {
        mapped.sub_images = rowImages.slice(1).map((img) => img.url);
      }
    }

    // Apply sensible defaults for missing fields
    if (!mapped.status) mapped.status = "available";
    if (!mapped.condition) mapped.condition = "good";
    if (!mapped.current_quantity) mapped.current_quantity = 1;
    if (mapped.is_borrowable === undefined || mapped.is_borrowable === null)
      mapped.is_borrowable = true;
    if (!mapped.unit) mapped.unit = "pcs";

    return mapped;
  };

  // ─── Import ──────────────────────────────────────────────────────────────
  const handleImport = async () => {
    setIsImporting(true);
    setImportProgress(0);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const failedRows: Array<{ row: number; error: string }> = [];

    try {
      // Build all mapped rows first
      const allRows = rawData.map((row, idx) => ({
        mapped: buildMappedRow(row, idx),
        originalIdx: idx,
        meta: rowMeta[idx],
      }));

      console.log(
        "handleImport: mode =",
        importMode,
        ", total rows =",
        allRows.length,
      );
      console.log(
        "handleImport: sample mapped row =",
        JSON.stringify(allRows[0]?.mapped),
      );

      if (importMode === "insert") {
        // Filter out duplicates detected in preview
        const rowsToInsert = allRows.filter((r) => {
          if (r.meta?.status === "duplicate") {
            skipped++;
            return false;
          }
          return true;
        });

        if (rowsToInsert.length === 0) {
          console.log(
            "handleImport: all rows are duplicates, nothing to insert",
          );
        } else {
          // Batch insert — use individual inserts to handle conflicts gracefully
          const batchSize = 25;
          for (let i = 0; i < rowsToInsert.length; i += batchSize) {
            const batch = rowsToInsert.slice(i, i + batchSize);

            // Try batch insert first
            const { data, error } = await supabase
              .from("items")
              .insert(batch.map((b) => b.mapped) as any)
              .select("id");

            if (error) {
              console.warn(`Batch ${i / batchSize + 1} failed:`, error.message);
              // Batch failed — retry individually to isolate the failing rows
              for (const entry of batch) {
                const { error: rowError } = await supabase
                  .from("items")
                  .insert(entry.mapped as any);
                if (rowError) {
                  if (
                    rowError.message.includes("duplicate key") ||
                    rowError.message.includes("unique constraint") ||
                    rowError.code === "23505"
                  ) {
                    skipped++;
                  } else {
                    console.error(
                      `Row ${entry.originalIdx + 2}:`,
                      rowError.message,
                    );
                    failed++;
                    failedRows.push({
                      row: entry.originalIdx + 2,
                      error: rowError.message,
                    });
                  }
                } else {
                  inserted++;
                }
              }
            } else {
              inserted += batch.length;
            }
            setImportProgress(
              Math.round(
                ((i + batch.length) / (rowsToInsert.length || 1)) * 100,
              ),
            );
          }
        }
      } else {
        // ─── Upsert mode ─────────────────────────────────────────────────
        // Use Supabase native upsert to handle both insert and update in one call
        const rowsWithCode = allRows.filter((r) => r.mapped.item_code);
        const rowsWithoutCode = allRows.filter((r) => !r.mapped.item_code);

        const totalRows = allRows.length;
        let processed = 0;

        // Rows with item_code: use Supabase .upsert() with onConflict
        if (rowsWithCode.length > 0) {
          const batchSize = 25;
          for (let i = 0; i < rowsWithCode.length; i += batchSize) {
            const batch = rowsWithCode.slice(i, i + batchSize);
            const { data, error } = await supabase
              .from("items")
              .upsert(batch.map((b) => b.mapped) as any, {
                onConflict: "item_code",
                ignoreDuplicates: false,
              })
              .select("id");

            if (error) {
              console.error(
                `Upsert batch ${i / batchSize + 1} failed:`,
                error.message,
              );
              // Fallback to individual processing
              for (const entry of batch) {
                // Try upsert individually
                const { error: rowError } = await supabase
                  .from("items")
                  .upsert(entry.mapped as any, {
                    onConflict: "item_code",
                    ignoreDuplicates: false,
                  });
                if (rowError) {
                  console.error(
                    `Row ${entry.originalIdx + 2}:`,
                    rowError.message,
                  );
                  failed++;
                  failedRows.push({
                    row: entry.originalIdx + 2,
                    error: rowError.message,
                  });
                } else {
                  // Check if it was an update or insert
                  if (entry.meta?.status === "update") {
                    updated++;
                  } else {
                    inserted++;
                  }
                }
              }
            } else {
              // Count batch results
              for (const entry of batch) {
                if (entry.meta?.status === "update") {
                  updated++;
                } else {
                  inserted++;
                }
              }
            }
            processed += batch.length;
            setImportProgress(Math.round((processed / (totalRows || 1)) * 100));
          }
        }

        // Rows without item_code: just insert (can't upsert without a conflict key)
        if (rowsWithoutCode.length > 0) {
          const batchSize = 25;
          for (let i = 0; i < rowsWithoutCode.length; i += batchSize) {
            const batch = rowsWithoutCode.slice(i, i + batchSize);
            const { error } = await supabase
              .from("items")
              .insert(batch.map((b) => b.mapped) as any);

            if (error) {
              for (const entry of batch) {
                const { error: rowError } = await supabase
                  .from("items")
                  .insert(entry.mapped as any);
                if (rowError) {
                  failed++;
                  failedRows.push({
                    row: entry.originalIdx + 2,
                    error: rowError.message,
                  });
                } else {
                  inserted++;
                }
              }
            } else {
              inserted += batch.length;
            }
            processed += batch.length;
            setImportProgress(Math.round((processed / (totalRows || 1)) * 100));
          }
        }
      }
    } catch (err: any) {
      console.error("Bulk import unexpected error:", err);
      toast({
        variant: "destructive",
        title: "Import Error",
        description:
          err?.message ||
          "An unexpected error occurred during import. Please try again.",
      });
    } finally {
      // ─── Download images to Supabase Storage & save to item_images ────
      if (inserted + updated > 0 && Object.keys(selectedImages).length > 0) {
        try {
          const nameField = Object.entries(columnMapping).find(
            ([, v]) => v === "name",
          )?.[0];
          const codeField = Object.entries(columnMapping).find(
            ([, v]) => v === "item_code",
          )?.[0];

          for (const [idxStr, imgs] of Object.entries(selectedImages)) {
            if (!imgs || imgs.length === 0) continue;
            const rowIdx = parseInt(idxStr);
            const row = rawData[rowIdx];
            if (!row) continue;

            let itemId: string | null = null;
            const itemCode = codeField
              ? String(row[codeField] || "").trim()
              : "";
            const itemName = nameField
              ? String(row[nameField] || "").trim()
              : "";

            if (itemCode) {
              const { data } = await supabase
                .from("items")
                .select("id")
                .eq("item_code", itemCode)
                .limit(1)
                .maybeSingle();
              if (data) itemId = data.id;
            }
            if (!itemId && itemName) {
              const { data } = await supabase
                .from("items")
                .select("id")
                .eq("name", itemName)
                .eq("department_id", selectedDepartmentId || departmentId)
                .limit(1)
                .maybeSingle();
              if (data) itemId = data.id;
            }

            if (itemId) {
              const imageRecords: any[] = [];
              for (let i = 0; i < imgs.length && i < 5; i++) {
                const img = imgs[i];
                let storagePath = "";
                try {
                  // Download image from Wikimedia URL
                  const imgResp = await fetch(img.url);
                  if (!imgResp.ok) throw new Error(`HTTP ${imgResp.status}`);
                  const blob = await imgResp.blob();
                  const ext =
                    img.url
                      .match(/\.(jpe?g|png|webp)/i)?.[1]
                      ?.replace("jpeg", "jpg") || "jpg";
                  storagePath = `${itemId}/${i}.${ext}`;

                  // Upload to Supabase Storage
                  const { error: uploadErr } = await supabase.storage
                    .from("item-images")
                    .upload(storagePath, blob, {
                      contentType: blob.type || "image/jpeg",
                      upsert: true,
                    });
                  if (uploadErr) throw uploadErr;

                  // Get public URL
                  const { data: urlData } = supabase.storage
                    .from("item-images")
                    .getPublicUrl(storagePath);

                  imageRecords.push({
                    item_id: itemId,
                    image_url: urlData.publicUrl,
                    is_primary: i === 0,
                    image_type: img.source === "manual" ? "manual" : "auto",
                    source: "wikimedia_auto",
                    sort_order: i,
                    uploaded_by: currentUserId,
                  });
                } catch (dlErr) {
                  console.warn(
                    `Failed to download image ${i} for item ${itemId}:`,
                    dlErr,
                  );
                  // Fallback: save external URL if download fails
                  imageRecords.push({
                    item_id: itemId,
                    image_url: img.url,
                    is_primary: i === 0,
                    image_type: img.source === "manual" ? "manual" : "auto",
                    source: img.source,
                    sort_order: i,
                    uploaded_by: currentUserId,
                  });
                }
              }
              if (imageRecords.length > 0) {
                await supabase
                  .from("item_images" as any)
                  .insert(imageRecords as any);
              }
            }
          }
          console.log("item_images records saved to storage successfully");
        } catch (imgErr) {
          console.warn("Failed to save item_images records:", imgErr);
        }
      }

      setImportProgress(100);
      setImportResults({ inserted, updated, skipped, failed, failedRows });
      setStep("import");
      setIsImporting(false);
    }

    // Show appropriate toast based on results
    if (inserted + updated > 0) {
      toast({
        title: "Import Complete",
        description: `${inserted > 0 ? `${inserted} inserted` : ""}${inserted > 0 && updated > 0 ? ", " : ""}${updated > 0 ? `${updated} updated` : ""}${skipped > 0 ? `, ${skipped} skipped` : ""}${failed > 0 ? `, ${failed} failed` : ""}.`,
      });
      onImportComplete();
    } else if (skipped > 0 && failed === 0) {
      toast({
        variant: "destructive",
        title: "All Items Already Exist",
        description: `All ${skipped} items were skipped because they already exist. Try using "Insert + Update" mode to update existing records.`,
      });
    } else if (failed > 0) {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: `${failed} items failed to import. Check the error details below.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "No Items Imported",
        description:
          "No items were imported. Check your data and column mapping.",
      });
    }
  };

  const getMappedCount = () =>
    Object.values(columnMapping).filter((v) => v && v !== "skip").length;

  // ─── Summary helpers ─────────────────────────────────────────────────────
  const newCount = rowMeta.filter((r) => r.status === "new").length;
  const updateCount = rowMeta.filter((r) => r.status === "update").length;
  const dupCount = rowMeta.filter((r) => r.status === "duplicate").length;

  const getRowStatusIcon = (status: RowStatus) => {
    switch (status) {
      case "new":
        return <CirclePlus className="h-4 w-4 text-emerald-500" />;
      case "update":
        return <ArrowUpDown className="h-4 w-4 text-blue-500" />;
      case "duplicate":
        return <CircleMinus className="h-4 w-4 text-amber-500" />;
      case "error":
        return <CircleAlert className="h-4 w-4 text-red-500" />;
    }
  };

  const getRowStatusBadge = (status: RowStatus) => {
    switch (status) {
      case "new":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 text-[10px]">
            New
          </Badge>
        );
      case "update":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-300 text-[10px]">
            Update
          </Badge>
        );
      case "duplicate":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-300 text-[10px]">
            Skip
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-300 text-[10px]">
            Error
          </Badge>
        );
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Bulk Import Items
          </DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Upload a CSV or Excel file to import items in bulk."}
            {step === "map" &&
              `Map your file columns to LabLink fields. ${getMappedCount()} of ${headers.length} columns mapped.`}
            {step === "enrich" &&
              "Auto-enrich missing fields using online sources and smart defaults."}
            {step === "preview" &&
              `Preview ${rawData.length} items before importing. ${errors.length > 0 ? `${errors.length} issues found.` : "No issues found."}`}
            {step === "import" &&
              (isImporting ? "Importing items..." : "Import complete!")}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 py-2 border-b mb-2">
          {(["upload", "map", "enrich", "preview", "import"] as Step[]).map(
            (s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : [
                            "upload",
                            "map",
                            "enrich",
                            "preview",
                            "import",
                          ].indexOf(step) > i
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {["upload", "map", "enrich", "preview", "import"].indexOf(
                    step,
                  ) > i ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs capitalize ${step === s ? "font-semibold" : "text-muted-foreground"}`}
                >
                  {s}
                </span>
                {i < 4 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground mx-1" />
                )}
              </div>
            ),
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── STEP 1: UPLOAD ─────────────────────────────────────────── */}
          {step === "upload" && (
            <div className="space-y-4">
              {/* Import Mode Selector */}
              <div className="flex items-center gap-6 p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Switch
                    id="import-mode"
                    checked={importMode === "upsert"}
                    onCheckedChange={(checked) =>
                      setImportMode(checked ? "upsert" : "insert")
                    }
                  />
                  <Label htmlFor="import-mode" className="cursor-pointer">
                    {importMode === "insert" ? (
                      <span className="flex items-center gap-1.5">
                        <CirclePlus className="h-4 w-4 text-emerald-500" />
                        <strong>Insert Only</strong> — skip items that already
                        exist
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <ArrowUpDown className="h-4 w-4 text-blue-500" />
                        <strong>Insert + Update</strong> — update existing items
                        by Item Code
                      </span>
                    )}
                  </Label>
                </div>
              </div>

              {/* Department Selector */}
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <Label className="text-sm font-medium shrink-0">
                  Target Department:
                </Label>
                <Select
                  value={selectedDepartmentId}
                  onValueChange={setSelectedDepartmentId}
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Select department..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedDepartmentId && (
                  <span className="text-xs text-red-500">Required</span>
                )}
              </div>

              {/* Drag & drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() =>
                  document.getElementById("bulk-file-input")?.click()
                }
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium mb-1">
                  Drop your file here or click to browse
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports CSV, XLSX, XLS files
                </p>
                <input
                  id="bulk-file-input"
                  type="file"
                  title="Upload file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

              {/* Download Template */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadTemplate();
                  }}
                >
                  <Download className="h-4 w-4" />
                  Download Import Template (.xlsx)
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: MAP COLUMNS ────────────────────────────────────── */}
          {step === "map" && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground mb-2">
                Map each column from your file to a LabLink field. Fields marked
                with * are required.
              </div>
              <div className="grid gap-2">
                {headers.map((header) => (
                  <div
                    key={header}
                    className="flex items-center gap-3 p-2 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{header}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Sample:{" "}
                        {String(rawData[0]?.[header] || "—").slice(0, 40)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select
                      value={columnMapping[header] || "skip"}
                      onValueChange={(v) =>
                        setColumnMapping((prev) => ({ ...prev, [header]: v }))
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">— Skip —</SelectItem>
                        {DB_FIELDS.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}
                            {f.required ? " *" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: ENRICH ──────────────────────────────────────────── */}
          {step === "enrich" && (
            <div className="space-y-4">
              {/* Validation errors */}
              {errors.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      {errors.length} validation{" "}
                      {errors.length === 1 ? "issue" : "issues"} found (will
                      still attempt import)
                    </span>
                  </div>
                  <ul className="text-xs space-y-1 max-h-20 overflow-y-auto">
                    {errors.slice(0, 5).map((e, i) => (
                      <li
                        key={i}
                        className="text-amber-600 dark:text-amber-400"
                      >
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                    {errors.length > 5 && (
                      <li className="text-muted-foreground">
                        ...and {errors.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Enrich action area */}
              <div className="p-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Globe className="h-8 w-8 text-primary" />
                  <Sparkles className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    Auto-Enrich Missing Fields
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Fetch descriptions and <strong>5 product images</strong> per
                    item from Wikimedia Commons. Also auto-generates item codes
                    and infers item types and safety levels.
                  </p>
                </div>
                <Button
                  onClick={handleEnrich}
                  disabled={isEnriching || enrichmentDone}
                  className="gap-2"
                  size="lg"
                >
                  {isEnriching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Enriching...
                    </>
                  ) : enrichmentDone ? (
                    <>
                      <Check className="h-4 w-4" /> Enrichment Complete
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4" /> Auto-Enrich {rawData.length}{" "}
                      Items
                    </>
                  )}
                </Button>
                {isEnriching && enrichProgress.total > 0 && (
                  <div className="w-full max-w-md mx-auto space-y-1">
                    <Progress
                      value={Math.round(
                        (enrichProgress.current / enrichProgress.total) * 100,
                      )}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Processing item {enrichProgress.current} of{" "}
                      {enrichProgress.total}
                    </p>
                  </div>
                )}
                {!enrichmentDone && !isEnriching && (
                  <p className="text-xs text-muted-foreground">
                    You can also skip this step and proceed directly to preview.
                  </p>
                )}
              </div>

              {/* Enrichment results — Interactive Image Gallery */}
              {enrichmentDone && Object.keys(enrichedFields).length > 0 && (
                <div className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Enrichment Results — Select Images
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300">
                        {
                          Object.values(enrichedFields).filter(
                            (e) => e.description,
                          ).length
                        }{" "}
                        descriptions
                      </Badge>
                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-300">
                        {Object.values(selectedImages).reduce(
                          (sum, imgs) => sum + imgs.length,
                          0,
                        )}{" "}
                        images selected
                      </Badge>
                      {(() => {
                        const total = Object.keys(enrichedFields).length;
                        const full = Object.entries(imageSearchStatus).filter(
                          ([, s]) => s === "found",
                        ).length;
                        const partial = Object.entries(
                          imageSearchStatus,
                        ).filter(([, s]) => s === "partial").length;
                        const none = Object.entries(imageSearchStatus).filter(
                          ([, s]) => s === "not_found",
                        ).length;
                        return (
                          <>
                            {full > 0 && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 gap-1">
                                <CircleCheck className="h-3 w-3" /> {full} 5/5
                              </Badge>
                            )}
                            {partial > 0 && (
                              <Badge className="bg-amber-500/10 text-amber-600 border-amber-300 gap-1">
                                <CircleAlert className="h-3 w-3" /> {partial}{" "}
                                partial
                              </Badge>
                            )}
                            {none > 0 && (
                              <Badge className="bg-red-500/10 text-red-600 border-red-300 gap-1">
                                <CircleAlert className="h-3 w-3" /> {none} no
                                images
                              </Badge>
                            )}
                          </>
                        );
                      })()}
                      <Badge className="bg-purple-500/10 text-purple-600 border-purple-300">
                        {
                          Object.values(enrichedFields).filter(
                            (e) => e.item_code,
                          ).length
                        }{" "}
                        codes
                      </Badge>
                    </div>
                  </div>

                  <ScrollArea className="h-[320px] border rounded-lg p-2">
                    <div className="space-y-3">
                      {Object.entries(enrichedFields)
                        .slice(0, 20)
                        .map(([idx, fields]) => {
                          const itemIdx = parseInt(idx);
                          const nf = Object.entries(columnMapping).find(
                            ([, v]) => v === "name",
                          )?.[0];
                          const itemName = nf
                            ? String(rawData[itemIdx]?.[nf] || "Unknown")
                            : "Item";
                          const allImgs: Array<{
                            url: string;
                            source: string;
                            width?: number;
                            height?: number;
                          }> = fields.all_images
                            ? (fields.all_images.value as any[])
                            : [];
                          const sel = selectedImages[itemIdx] || [];
                          const isSel = (url: string) =>
                            sel.some((s) => s.url === url);
                          const toggle = (img: {
                            url: string;
                            source: string;
                            width?: number;
                            height?: number;
                          }) => {
                            setSelectedImages((prev) => {
                              const c = prev[itemIdx] || [];
                              return {
                                ...prev,
                                [itemIdx]: c.some((s) => s.url === img.url)
                                  ? c.filter((s) => s.url !== img.url)
                                  : [...c, img],
                              };
                            });
                          };
                          const addUrl = () => {
                            const u = (manualImageUrl[itemIdx] || "").trim();
                            if (!u || !u.startsWith("http")) return;
                            const img = { url: u, source: "manual" };
                            setSelectedImages((prev) => ({
                              ...prev,
                              [itemIdx]: [...(prev[itemIdx] || []), img],
                            }));
                            setEnrichedFields((prev) => ({
                              ...prev,
                              [itemIdx]: {
                                ...prev[itemIdx],
                                all_images: {
                                  value: [...allImgs, img],
                                  source: "manual",
                                },
                              },
                            }));
                            setManualImageUrl((prev) => ({
                              ...prev,
                              [itemIdx]: "",
                            }));
                          };
                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-lg bg-muted/40 border space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-semibold truncate">
                                    {itemName}
                                  </span>
                                  {/* Image count badge */}
                                  {(() => {
                                    const status = imageSearchStatus[itemIdx];
                                    const imgCount = allImgs.length;
                                    if (status === "found" || imgCount >= 5)
                                      return (
                                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 text-[10px] gap-0.5 shrink-0">
                                          <CircleCheck className="h-2.5 w-2.5" />{" "}
                                          5/5
                                        </Badge>
                                      );
                                    if (status === "partial" || imgCount > 0)
                                      return (
                                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-300 text-[10px] gap-0.5 shrink-0">
                                          <CircleAlert className="h-2.5 w-2.5" />{" "}
                                          {imgCount}/5
                                        </Badge>
                                      );
                                    return (
                                      <Badge className="bg-red-500/10 text-red-600 border-red-300 text-[10px] gap-0.5 shrink-0">
                                        <CircleAlert className="h-2.5 w-2.5" />{" "}
                                        No Images
                                      </Badge>
                                    );
                                  })()}
                                </div>
                                <div className="flex flex-wrap gap-1 items-center">
                                  {Object.entries(fields)
                                    .filter(
                                      ([f]) =>
                                        ![
                                          "image_url",
                                          "sub_images",
                                          "all_images",
                                        ].includes(f),
                                    )
                                    .map(([f, d]) => (
                                      <Badge
                                        key={f}
                                        variant="outline"
                                        className="text-[10px] gap-0.5"
                                      >
                                        {[
                                          "online",
                                          "wikipedia",
                                          "duckduckgo",
                                          "google",
                                          "wikimedia",
                                        ].includes(d.source) ? (
                                          <Globe className="h-2.5 w-2.5 text-blue-500" />
                                        ) : (
                                          <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                                        )}
                                        {f}
                                      </Badge>
                                    ))}
                                  {/* Re-fetch button */}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 gap-1 text-[10px]"
                                    onClick={async () => {
                                      try {
                                        const bf = Object.entries(
                                          columnMapping,
                                        ).find(([, v]) => v === "brand")?.[0];
                                        const mf = Object.entries(
                                          columnMapping,
                                        ).find(
                                          ([, v]) => v === "model_number",
                                        )?.[0];
                                        const { data, error } =
                                          await supabase.functions.invoke(
                                            "enrich-items",
                                            {
                                              body: {
                                                items: [
                                                  {
                                                    name: itemName,
                                                    brand: bf
                                                      ? String(
                                                          rawData[itemIdx]?.[
                                                            bf
                                                          ] || "",
                                                        ).trim()
                                                      : undefined,
                                                    catalog_number: mf
                                                      ? String(
                                                          rawData[itemIdx]?.[
                                                            mf
                                                          ] || "",
                                                        ).trim()
                                                      : undefined,
                                                  },
                                                ],
                                              },
                                            },
                                          );
                                        if (!error && data?.results?.[0]) {
                                          const result = data.results[0];
                                          const newImgs = (
                                            result.image_urls || []
                                          ).map((img: any) =>
                                            typeof img === "string"
                                              ? {
                                                  url: img,
                                                  source: "wikimedia_auto",
                                                }
                                              : img,
                                          );
                                          setEnrichedFields((prev) => ({
                                            ...prev,
                                            [itemIdx]: {
                                              ...prev[itemIdx],
                                              all_images: {
                                                value: newImgs,
                                                source: "wikimedia_auto",
                                              },
                                              image_url: newImgs[0]
                                                ? {
                                                    value: newImgs[0].url,
                                                    source: "wikimedia_auto",
                                                  }
                                                : prev[itemIdx]?.image_url,
                                            },
                                          }));
                                          setSelectedImages((prev) => ({
                                            ...prev,
                                            [itemIdx]: newImgs,
                                          }));
                                          setImageSearchStatus((prev) => ({
                                            ...prev,
                                            [itemIdx]:
                                              result.image_search_status ||
                                              (newImgs.length >= 5
                                                ? "found"
                                                : newImgs.length > 0
                                                  ? "partial"
                                                  : "not_found"),
                                          }));
                                          toast({
                                            title: "Re-fetch Complete",
                                            description: `Found ${newImgs.length} images for ${itemName}`,
                                          });
                                        }
                                      } catch (err) {
                                        console.error("Re-fetch error:", err);
                                        toast({
                                          variant: "destructive",
                                          title: "Re-fetch Failed",
                                          description:
                                            "Could not fetch images. Try again.",
                                        });
                                      }
                                    }}
                                  >
                                    <RefreshCw className="h-2.5 w-2.5" />{" "}
                                    Re-fetch
                                  </Button>
                                </div>
                              </div>
                              {allImgs.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {allImgs.map((img, ii) => (
                                    <div
                                      key={ii}
                                      className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:scale-105 ${
                                        isSel(img.url)
                                          ? "border-primary ring-2 ring-primary/30"
                                          : "border-muted hover:border-primary/50"
                                      }`}
                                      onClick={() => toggle(img)}
                                    >
                                      <img
                                        src={img.url}
                                        alt={`${itemName} ${ii + 1}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src =
                                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23a1a1aa' font-size='10'%3EError%3C/text%3E%3C/svg%3E";
                                        }}
                                      />
                                      <div
                                        className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-sm flex items-center justify-center ${isSel(img.url) ? "bg-primary text-primary-foreground" : "bg-black/40 text-white/70"}`}
                                      >
                                        {isSel(img.url) && (
                                          <Check className="h-3 w-3" />
                                        )}
                                      </div>
                                      {sel.length > 0 &&
                                        sel[0].url === img.url && (
                                          <div className="absolute bottom-0 left-0 right-0 bg-primary/80 text-primary-foreground text-[8px] text-center py-0.5 font-bold">
                                            PRIMARY
                                          </div>
                                        )}
                                      <div className="absolute top-0.5 left-0.5 bg-black/50 text-white text-[7px] px-1 rounded">
                                        {img.source}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                  <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                                    No images found — use the URL input below to
                                    add manually
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder="Paste image URL..."
                                  value={manualImageUrl[itemIdx] || ""}
                                  onChange={(e) =>
                                    setManualImageUrl((prev) => ({
                                      ...prev,
                                      [itemIdx]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") addUrl();
                                  }}
                                  className="h-7 text-xs flex-1"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 gap-1"
                                  onClick={addUrl}
                                  disabled={
                                    !(manualImageUrl[itemIdx] || "")
                                      .trim()
                                      .startsWith("http")
                                  }
                                >
                                  <Plus className="h-3 w-3" /> Add
                                </Button>
                              </div>
                              {sel.length > 0 && (
                                <p className="text-[10px] text-muted-foreground">
                                  {sel.length} image
                                  {sel.length !== 1 ? "s" : ""} selected
                                  {sel.length > 1 &&
                                    ` (1 primary + ${sel.length - 1} additional)`}
                                </p>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4: PREVIEW ────────────────────────────────────────── */}
          {step === "preview" && (
            <div className="space-y-4">
              {/* Duplicate detection status */}
              {isCheckingDuplicates ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm">
                    Checking for existing items...
                  </span>
                </div>
              ) : (
                rowMeta.length > 0 && (
                  <div className="flex flex-wrap gap-3 p-3 rounded-lg border bg-muted/30">
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 gap-1">
                      <CirclePlus className="h-3 w-3" /> {newCount} New
                    </Badge>
                    {importMode === "upsert" && updateCount > 0 && (
                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-300 gap-1">
                        <ArrowUpDown className="h-3 w-3" /> {updateCount} Update
                      </Badge>
                    )}
                    {dupCount > 0 && (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-300 gap-1">
                        <CircleMinus className="h-3 w-3" /> {dupCount}{" "}
                        {importMode === "insert" ? "Skip (duplicate)" : ""}
                      </Badge>
                    )}
                    <Badge variant="outline" className="gap-1 text-xs">
                      {rawData.length} total rows
                    </Badge>
                  </div>
                )
              )}

              {/* Validation errors */}
              {errors.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      {errors.length} validation{" "}
                      {errors.length === 1 ? "issue" : "issues"} found
                    </span>
                  </div>
                  <ul className="text-xs space-y-1 max-h-24 overflow-y-auto">
                    {errors.slice(0, 10).map((e, i) => (
                      <li
                        key={i}
                        className="text-amber-600 dark:text-amber-400"
                      >
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                    {errors.length > 10 && (
                      <li className="text-muted-foreground">
                        ...and {errors.length - 10} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-16">Status</TableHead>
                      <TableHead className="w-14">Image</TableHead>
                      {Object.entries(columnMapping)
                        .filter(([, v]) => v && v !== "skip")
                        .map(([source, target]) => (
                          <TableHead key={source}>
                            {DB_FIELDS.find((f) => f.key === target)?.label ||
                              target}
                          </TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawData.slice(0, 25).map((row, idx) => (
                      <TableRow
                        key={idx}
                        className={
                          rowMeta[idx]?.status === "duplicate"
                            ? "opacity-50"
                            : rowMeta[idx]?.status === "update"
                              ? "bg-blue-50/50 dark:bg-blue-950/20"
                              : ""
                        }
                      >
                        <TableCell className="text-muted-foreground text-xs">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                {rowMeta[idx] ? (
                                  getRowStatusBadge(rowMeta[idx].status)
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    —
                                  </Badge>
                                )}
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p className="text-xs">
                                  {rowMeta[idx]?.message || "Pending check"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          {selectedImages[idx]?.length > 0 ? (
                            <div className="relative w-fit">
                              <img
                                src={selectedImages[idx][0].url}
                                alt=""
                                className="w-8 h-8 rounded object-cover border"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                              {selectedImages[idx].length > 1 && (
                                <Badge className="absolute -top-2 -right-2 h-4 min-w-[1rem] px-1 bg-primary text-[8px] flex items-center justify-center rounded-full border-none font-bold">
                                  {selectedImages[idx].length}
                                </Badge>
                              )}
                            </div>
                          ) : enrichedFields[idx]?.image_url ? (
                            <img
                              src={String(enrichedFields[idx].image_url.value)}
                              alt=""
                              className="w-8 h-8 rounded object-cover border"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded border bg-muted flex items-center justify-center">
                              <ImageIcon className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        {Object.entries(columnMapping)
                          .filter(([, v]) => v && v !== "skip")
                          .map(([source]) => (
                            <TableCell
                              key={source}
                              className="text-sm truncate max-w-[150px]"
                            >
                              {String(row[source] || "—")}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rawData.length > 25 && (
                <p className="text-xs text-muted-foreground text-center">
                  Showing first 25 of {rawData.length} rows
                </p>
              )}
            </div>
          )}

          {/* ── STEP 4: IMPORT PROGRESS / RESULTS ──────────────────────── */}
          {step === "import" && (
            <div className="py-8 text-center space-y-6">
              {isImporting ? (
                <>
                  <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                  <div>
                    <p className="text-lg font-medium mb-2">
                      Importing items...
                    </p>
                    <Progress
                      value={importProgress}
                      className="max-w-xs mx-auto"
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      {importProgress}% complete
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Dynamic icon based on outcome */}
                  <div
                    className={`h-16 w-16 rounded-full mx-auto flex items-center justify-center ${
                      importResults.inserted + importResults.updated > 0
                        ? "bg-emerald-500/10"
                        : importResults.skipped > 0 &&
                            importResults.failed === 0
                          ? "bg-amber-500/10"
                          : "bg-red-500/10"
                    }`}
                  >
                    {importResults.inserted + importResults.updated > 0 ? (
                      <CircleCheck className="h-8 w-8 text-emerald-500" />
                    ) : importResults.skipped > 0 &&
                      importResults.failed === 0 ? (
                      <AlertTriangle className="h-8 w-8 text-amber-500" />
                    ) : (
                      <CircleAlert className="h-8 w-8 text-red-500" />
                    )}
                  </div>

                  {/* Dynamic title based on outcome */}
                  <div>
                    <p className="text-lg font-medium">
                      {importResults.inserted + importResults.updated > 0
                        ? "Import Successful"
                        : importResults.skipped > 0 &&
                            importResults.failed === 0
                          ? "No New Items Imported"
                          : "Import Failed"}
                    </p>

                    {/* Explanation for skipped-only */}
                    {importResults.inserted + importResults.updated === 0 &&
                      importResults.skipped > 0 &&
                      importResults.failed === 0 && (
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                          All {importResults.skipped} items already exist in the
                          database (matching item code or serial number). Use{" "}
                          <strong>"Insert + Update"</strong> mode to update
                          existing records.
                        </p>
                      )}

                    <div className="flex gap-3 justify-center mt-3 flex-wrap">
                      {importResults.inserted > 0 && (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-sm px-3 py-1 gap-1">
                          <CirclePlus className="h-3.5 w-3.5" />{" "}
                          {importResults.inserted} Inserted
                        </Badge>
                      )}
                      {importResults.updated > 0 && (
                        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-sm px-3 py-1 gap-1">
                          <ArrowUpDown className="h-3.5 w-3.5" />{" "}
                          {importResults.updated} Updated
                        </Badge>
                      )}
                      {importResults.skipped > 0 && (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-sm px-3 py-1 gap-1">
                          <CircleMinus className="h-3.5 w-3.5" />{" "}
                          {importResults.skipped} Skipped (duplicates)
                        </Badge>
                      )}
                      {importResults.failed > 0 && (
                        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-sm px-3 py-1 gap-1">
                          <CircleAlert className="h-3.5 w-3.5" />{" "}
                          {importResults.failed} Failed
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Retry with Update Mode button */}
                  {importResults.inserted + importResults.updated === 0 &&
                    importResults.skipped > 0 && (
                      <Button
                        variant="outline"
                        className="gap-2 mx-auto"
                        onClick={() => {
                          setImportMode("upsert");
                          setStep("preview");
                          checkDuplicates();
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Retry with Insert + Update Mode
                      </Button>
                    )}

                  {/* Failed rows detail */}
                  {importResults.failedRows.length > 0 && (
                    <div className="mt-4 text-left max-w-lg mx-auto">
                      <p className="text-sm font-medium mb-2 text-red-600">
                        Failed Rows:
                      </p>
                      <ScrollArea className="h-[120px] border rounded-lg p-2">
                        <ul className="text-xs space-y-1">
                          {importResults.failedRows.map((fr, i) => (
                            <li
                              key={i}
                              className="text-red-600 dark:text-red-400"
                            >
                              Row {fr.row}: {fr.error}
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t mt-2">
          <Button
            variant="ghost"
            onClick={() => {
              if (step === "map") setStep("upload");
              else if (step === "enrich") setStep("map");
              else if (step === "preview") setStep("enrich");
            }}
            disabled={step === "upload" || step === "import"}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              {step === "import" && !isImporting ? "Done" : "Cancel"}
            </Button>
            {step === "map" && (
              <Button
                onClick={goToEnrich}
                className="gap-1"
                disabled={getMappedCount() === 0}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === "enrich" && (
              <Button onClick={goToPreview} className="gap-1">
                {enrichmentDone ? "Preview" : "Skip & Preview"}{" "}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === "preview" && (
              <Button
                onClick={handleImport}
                className="gap-1"
                disabled={
                  errors.some((e) => e.row === 0) ||
                  isCheckingDuplicates ||
                  !(selectedDepartmentId || departmentId)
                }
                title={
                  !(selectedDepartmentId || departmentId)
                    ? "No department selected"
                    : ""
                }
              >
                <Upload className="h-4 w-4" />
                Import {importMode === "insert"
                  ? newCount
                  : rawData.length}{" "}
                Items
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
