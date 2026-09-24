FIS SRT Snapshot
Generated: 2026-09-24T12:19:29.808Z

IMPORTANT: The deployed SRT currently loads data.js at runtime.
Replacing shaft_data.json by itself will NOT update the SRT.

Deploy these files:
  data.js                         -> SRT repository root
  data/shaft_data.json            -> SRT data folder
  data/head_data.json             -> SRT data folder
  data/data_version.json          -> SRT data folder

Shaft rows: 3191
Operational head rows: 975

The JSON files mirror the embedded arrays in data.js.
The root-level duplicate shaft_data.json/head_data.json/data_version.json files in the old SRT repository are not used by index.html and can be removed to avoid confusion.
No SRT scoring code change is required.