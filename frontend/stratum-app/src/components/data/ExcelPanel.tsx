/**
 * @file
 * Excel file viewer panel component.
 *
 * Parses and displays Excel spreadsheet data in a
 * tabular format.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React from "react";
import GridPanel from "./GridPanel";

interface Props {
  table: string[][];
  setTable: (updater: (prev: string[][]) => string[][]) => void;
  editing: boolean;
  onDirty: () => void;
}

export default function ExcelPanel(props: Props) {
  return <GridPanel {...props} />;
}
