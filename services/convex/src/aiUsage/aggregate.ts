import { TableAggregate } from "@convex-dev/aggregate";

import type { DataModel } from "../_generated/dataModel";
import { components } from "../_generated/api";

export const aiUsageAggregate = new TableAggregate<{
  Namespace: string;
  Key: number;
  DataModel: DataModel;
  TableName: "aiUsage";
}>(components.aggregateAiUsage, {
  namespace: (doc) => doc.ownerId,
  sortKey: (doc) => doc.createdAt,
  sumValue: (doc) => doc.costUsd,
});
