/**
 * Responsive KPI band: flex-wrap + flex-grow so orphaned cards on the last row
 * stretch to fill the row (CSS grid auto-fit leaves empty tracks when an earlier
 * row uses more columns).
 */
export const KPI_GRID_CLASS =
  'flex flex-wrap gap-3 [&>*]:flex-[1_1_11rem] [&>*]:min-w-[11rem] [&>*]:max-w-full';
