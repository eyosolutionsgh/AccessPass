/** Convenience row types inferred from the Drizzle schema. */
import type {
  accessPermission,
  auditLog,
  checkInRecord,
  credential,
  documentRecord,
  host,
  incident,
  notification,
  preRegistration,
  facility,
  visit,
  visitInvitation,
  visitor,
  visitorCategory,
  watchlistEntry,
} from './schema/index.ts';

export type Facility = typeof facility.$inferSelect;
export type Host = typeof host.$inferSelect;
export type Visitor = typeof visitor.$inferSelect;
export type VisitorCategory = typeof visitorCategory.$inferSelect;
export type WatchlistEntry = typeof watchlistEntry.$inferSelect;

export type Visit = typeof visit.$inferSelect;
export type NewVisit = typeof visit.$inferInsert;
export type VisitInvitation = typeof visitInvitation.$inferSelect;
export type PreRegistration = typeof preRegistration.$inferSelect;

export type CheckInRecord = typeof checkInRecord.$inferSelect;
export type Credential = typeof credential.$inferSelect;
export type AccessPermission = typeof accessPermission.$inferSelect;

export type DocumentRecord = typeof documentRecord.$inferSelect;
export type Notification = typeof notification.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
export type Incident = typeof incident.$inferSelect;
