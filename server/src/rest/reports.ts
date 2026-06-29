import { fromNodeHeaders } from 'better-auth/node';
import { Router, type NextFunction, type Request, type Response } from 'express';
import ExcelJS from 'exceljs';
import { anyRoleHasPermission, insightsLogSchema } from '@vms/shared';
import { auth } from '../auth.ts';
import { asyncHandler } from '../lib/http-errors.ts';
import { insightsLogExport } from '../services/reports.ts';

/**
 * Staff-facing visitor-log exports (SRS §12.1). Binary downloads (CSV/XLSX) live outside tRPC.
 * Gated by the better-auth session + `report:['insights']`; the data is facility-scoped to the
 * caller (front-line operators get their facility, management gets org-wide) and honours the same
 * status / origin / search / date filters as the on-screen list.
 */
export const reportExportRouter = Router();

async function requireInsights(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  const role = (session?.user as { role?: string | null })?.role ?? null;
  if (!session?.user || !anyRoleHasPermission(role, { report: ['insights'] })) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  res.locals.actor = { id: session.user.id, role };
  next();
}

const COLUMNS = [
  { header: 'Visitor', key: 'visitorName' },
  { header: 'Organization', key: 'organization' },
  { header: 'Type', key: 'origin' },
  { header: 'Host', key: 'hostName' },
  { header: 'Department', key: 'departmentName' },
  { header: 'Facility', key: 'facilityName' },
  { header: 'Status', key: 'status' },
  { header: 'Checked In', key: 'timeIn' },
  { header: 'Checked Out', key: 'timeOut' },
] as const;

function toRows(log: Awaited<ReturnType<typeof insightsLogExport>>) {
  return log.map((r) => ({
    visitorName: r.visitorName ?? '',
    organization: r.organization ?? '',
    origin: r.origin === 'walk_in' ? 'Walk-in' : 'Scheduled',
    hostName: r.hostName ?? '',
    departmentName: r.departmentName ?? '',
    facilityName: r.facilityName ?? '',
    status: r.status,
    timeIn: r.timeIn ? new Date(r.timeIn).toISOString() : '',
    timeOut: r.timeOut ? new Date(r.timeOut).toISOString() : '',
  }));
}

reportExportRouter.use(asyncHandler(requireInsights));

reportExportRouter.get(
  '/visitor-log.csv',
  asyncHandler(async (req, res) => {
    const input = insightsLogSchema.parse(req.query);
    const rows = toRows(await insightsLogExport(input, res.locals.actor));
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      COLUMNS.map((c) => c.header).join(','),
      ...rows.map((r) => COLUMNS.map((c) => esc(r[c.key])).join(',')),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="visitor-log.csv"');
    res.send(csv);
  }),
);

reportExportRouter.get(
  '/visitor-log.xlsx',
  asyncHandler(async (req, res) => {
    const input = insightsLogSchema.parse(req.query);
    const rows = toRows(await insightsLogExport(input, res.locals.actor));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Visitor Log');
    ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 20 }));
    ws.getRow(1).font = { bold: true };
    ws.addRows(rows);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="visitor-log.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  }),
);
