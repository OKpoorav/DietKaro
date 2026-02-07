# Medical Log Analysis System Specification

## Overview
This system enables the automated extraction, analysis, and tracking of biomarker data from client-uploaded medical reports (PDFs, Images). It uses AI/OCR to parse values, compare them against reference ranges, and flag anomalies for dietitian review.

## Objectives
1.  **Automated Extraction**: Convert unstructured medical reports into structured data.
2.  **Health Tracking**: Monitor biomarker trends over time (e.g., HbA1c improvement).
3.  **Automated Intelligence**: Auto-tag clients based on results (e.g., "High Cholesterol").
4.  **Dietitian Efficiency**: Reduce manual data entry and provide "Out of Range" alerts.

---

## 1. Data Schema Enhancements

### New Model: `LabReport` (Enhancement of `ClientReport`)
Extends existing `ClientReport` or added as a relation.

```prisma
model LabReport {
  id              String        @id @default(uuid())
  clientReportId  String        @unique // Link to the uploaded file
  analyzedAt      DateTime      @default(now())
  status          String        // PENDING, PROCESSING, COMPLETED, FAILED, REVIEW_NEEDED
  labName         String?
  collectionDate  DateTime?
  
  results         LabResult[]
  
  report          ClientReport  @relation(fields: [clientReportId], references: [id])
}

model LabResult {
  id            String    @id @default(uuid())
  labReportId   String
  biomarker     String    // e.g., "Hemoglobin", "TSH" 
  value         Float
  unit          String?   // e.g., "g/dL", "mIU/L"
  referenceLow  Float?
  referenceHigh Float?
  status        String    // NORMAL, LOW, HIGH, CRITICAL
  tags          String[]  // ["anemia_indicator"]
  
  report        LabReport @relation(fields: [labReportId], references: [id])
}
```

---

## 2. Analysis Pipeline

### Step 1: Trigger Analysis
*   **Trigger**: `POST /api/v1/reports/:id/analyze` or Auto-trigger on upload.
*   **Input**: `fileUrl` (S3 path).

### Step 2: OCR & Extraction (AI Service)
*   **Service**: Use OpenAI GPT-4o Vision or AWS Textract to parse the document.
*   **Prompt/Logic**:
    > "Extract all lab results from this image. For each result, identify the Test Name, Value, Unit, and Reference Range. Return as JSON."
*   **Normalization**: Map varied names (e.g., "Hgb", "Haemoglobin") to a standard defined set (`biomarkerKey`).

### Step 3: Validation & Flagging
*   **Logic**:
    *   Parse numerical value.
    *   Compare with extracted Reference Range (or system default if missing).
    *   Assign Status: `LOW` (< min), `HIGH` (> max), `NORMAL`.
*   **Tagging**:
    *   IF `HbA1c > 6.5` -> Add Client Tag: `diabetes`.
    *   IF `VitD < 20` -> Add Client Tag: `vitamin_d_deficiency`.

### Step 4: Storage
*   Save structured data to `LabReport` and `LabResult` tables.
*   Update `Client.labDerivedTags`.

---

## 3. API Endpoints

### Client Side
*   `POST /api/v1/reports` (Existing): Uploads file.
*   `GET /api/v1/reports`: View uploaded reports.

### Dietitian/Admin Side
*   `POST /api/v1/reports/:id/analyze`: Trigger analysis manually.
*   `GET /api/v1/reports/:id/analysis`: Get structured results.
*   `PATCH /api/v1/reports/:id/results/:resultId`: Correct AI mistakes (manual override).
*   `GET /api/v1/clients/:clientId/trends`: Get historical data for specific biomarkers (e.g., TSH over last 6 months).

---

## 4. Implementation Steps

### Phase 1: Infrastructure
1.  Create `LabReport` and `LabResult` models in Prisma.
2.  Set up `AnalysisService` skeleton.

### Phase 2: AI Integration
1.  Integrate AI Provider (OpenAI/Anthropic).
2.  Implement `extractDataFromUrl(url)` method.
3.  Implement parsing logic to handle diverse report formats.

### Phase 3: Dashboard UI
1.  **Results View**: Table showing Test, Value, Range, and Status (Color-coded).
2.  **Trend Graph**: Line chart for key metrics.
3.  **Review Mode**: Interface for Dietitians to verify and approve AI data.

## 5. Security & Privacy
*   **PII Handling**: Scrub non-essential PII before sending to external AI APIs where possible.
*   **Compliance**: Ensure HIPAA/GDPR compliance storage of medical data.
