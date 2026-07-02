/**
 * @file
 * Common components barrel export.
 *
 * Re-exports all shared UI components.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
export { default as Button } from "./Button";
export { default as TextInput } from "./TextInput";
export { default as Loading } from "./Loading";
export { default as Card } from "./Card";
export {
  Skeleton,
  ProjectCardSkeleton,
  ProjectListSkeleton,
  OverviewSkeleton,
  NoteDetailSkeleton,
  ArtefactGridSkeleton,
  ArtefactDetailSkeleton,
  ProjectDetailSkeleton,
  ActivityCardSkeleton,
  ActivityListSkeleton,
} from "./Skeleton";
