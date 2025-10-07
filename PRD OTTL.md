**Here is a reworked Product Requirements Document (PRD) based on your assignment context, focusing on the product’s operation, block structure, configuration interactions (no natural language input), and the use of Next.js for implementation.**

---

## **Product Requirements Document (PRD): OTTL Visual Transformation Tool**

## **Overview**

**The OTTL Visual Transformation Tool is a no-code web application, built with Next.js, that empowers users to upload or paste OpenTelemetry telemetry data (logs, metrics, traces) and visually construct a transformation pipeline using modular “blocks.” The tool enables users to manipulate telemetry data entirely via a point-and-click interface—no scripting or natural language required.**

---

## **User Workflow**

1. **Data Input**

   * **Users can upload telemetry data files or paste raw JSON into a left-side panel.**

   * **The system detects the signal type (trace, metric, or log) automatically.**

   * **Only blocks and config options relevant to the detected signal type are enabled.**

2. **Building the Transformation Pipeline**

   * **Users press a shortcut (e.g., spacebar or “/”) to open a Block Picker Dropdown.**

   * **Selecting a block adds it to the central pipeline canvas (visual flow editor).**

   * **Each block on the canvas immediately exposes a Configure button.**

3. **Block Configuration**

   * **Clicking Configure on any block opens a modal/panel with precise fields for setup (select inputs, checkboxes, value pickers, etc.).**

   * **No free-text or natural language input—all choices are via controlled UI elements (dropdown, search, checkboxes, tables).**

   * **Typical config includes:**

     * **Target Level: Use dropdowns for scope (Resource, All Spans, Root Spans, Custom filter builder with rows for “where field equals value” logic).**

     * **Field/Key Selection: Dropdowns with autocomplete listing only fields/attributes present in the loaded data.**

     * **Values: Where possible, value inputs also support autocomplete from those present in the data.**

   * **The user can only save valid configurations (validated in real time).**

4. **Live Preview & Feedback**

   * **The right panel shows a live data preview reflecting all transformations up to the currently selected block.**

   * **Blocks highlight changes (added, changed, removed attributes/fields), and users can inspect data at any step.**

   * **The empty state is a friendly message (“Nothing to preview yet. Add your first block to begin.”).**

   * **When users click a block, the preview updates to show results through that stage.**

---

## **Block Library**

**Each block performs a single, well-defined operation. Configuration panels are always form-based, never natural language.**

## **General Blocks (available for all signals)**

* **Add Attribute**

  * **Configure:**

    * **Target level: Dropdown (Resource, All Spans, Root Spans, Custom builder for AND-joined conditions)**

    * **Attribute Key: Dropdown/autocomplete from known keys, or manual input**

    * **Attribute Value: Text or dropdown/autocomplete from known values**

* **Remove Attribute**

  * **Attribute Key(s): Multi-select dropdown from present keys**

  * **Target level: dropdown as above**

* **Rename Attribute**

  * **Attribute Key (from): Dropdown from existing keys**

  * **Attribute Key (to): Text input**

  * **Target level: dropdown as above**

* **Mask Attribute**

  * **Attribute Key(s): Multi-select dropdown**

  * **Mask type: Dropdown (full, partial, regex, etc.)**

  * **Target level: dropdown as above**

---

## **Trace-Specific Blocks**

* **Edit Parent/Child**

  * **Span to edit: Dropdown/autocomplete from available spans (by operation name or spanId)**

  * **New parent: Dropdown from available parent candidates (or “make root”)**

  * **Optionally reassign children**

* **Edit Trace/Span ID**

  * **Target: Dropdown (Trace ID, Span ID, or both)**

  * **Operation: Dropdown (Randomize, Change to specific, Pattern, Mask, etc.)**

  * **Demo table of before/after**

* **Other (if required by spec):**

  * **Blocks for special cases like merging/splitting traces as determined by assignment**

---

## **Metric-Specific Blocks**

* **Rename Metric**

  * **From: Dropdown of existing metric names**

  * **To: Text input**

* **Edit Metric Value**

  * **Metric: Dropdown of metric series**

  * **Operation: Dropdown (Add, Subtract, Multiply, Divide, Set constant)**

  * **Value: Number input**

* **Unit Conversion**

  * **Metric: Dropdown**

  * **From unit/to unit: Dropdowns with allowed units**

* **Aggregate Series**

  * **Metrics to group: Multi-select**

  * **Aggregation function: Dropdown (sum, avg, min, max)**

* **Edit Labels**

  * **Label key(s): Multi-select**

  * **Operation: Dropdown (Rename, Remove, Mask, Change value)**

  * **New value/key: Input depending on operation**

---

## **Log-Specific Blocks**

* **Rename Log Field**

  * **Field: Dropdown from log fields**

  * **New name: Text input**

* **Mask Log Field**

  * **Field(s): Dropdown/multi-select**

  * **Mask style: Dropdown**

---

## **Advanced**

* **Raw OTTL Block**

  * **For expert users only—enter raw OTTL expressions in text area.**

  * **Syntax highlighting, help sidebar**

---

## **Preview/Feedback Panel (Right Side)**

* **Live updates after every pipeline stage.**

* **Shows side-by-side diff (before/after) for easy verification.**

* **Click a block to inspect state at that transformation.**

* **All changes (added/removed/modified data) visually marked.**

* **Supports traces (span map), metrics (series table/chart), logs (log list).**

* **Empty state: “Nothing to preview yet. Add your first block to begin.”**

---

## **Implementation Constraints**

* **Framework:**

  * **This app is built entirely with Next.js (React-based, server-side rendering as needed).**

* **No natural language processing for block configs.**

* **Performance:**

  * **UI supports real-time previews even with thousands of spans, metrics, or logs (optimizations as needed).**

* **Accessibility and Responsiveness:**

  * **All interactive elements must be keyboard-accessible and responsive for usability.**

---

## **Design Summary**

* **All block configuration via explicit, controlled UI components.**

* **Dynamic option population—dropdowns and autocompletes use real fields and values found in the loaded telemetry data for accuracy and ease.**

* **Pipeline is always visually explorable and editable, with every step clearly configurable via a Configure button.**

* **Preview panel provides instant, transparent feedback.**

