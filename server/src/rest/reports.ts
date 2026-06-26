import { fromNodeHeaders } from 'better-auth/node';
import { Router, type NextFunction, type Request, type Response } from 'express';
import ExcelJS from 'exceljs';
import { anyRoleHasPermission, reportRangeSchema } from '@vms/shared';
import { auth } from '../auth.ts';
import { asyncHandler } from '../lib/http-errors.ts';
import { visitorLog } from '../services/reports.ts';

/**
 * Staff-facing report exports (SRS §12.1). Binary downloads (CSV/XLSX) live outside tRPC.
 * Gated by the better-auth session + `report:export` permission; downloads send the cookie.
 */
export const reportExportRouter = Router();

async function requireReportExport(req: Request, res: Response, next: NextFunction) {
  const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  const role = (result?.user as { role?: string | null })?.role ?? null;
  if (!anyRoleHasPermission(role, { report: ['export'] })) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}

const COLUMNS = [
  { header: 'Visitor', key: 'visitorName' },
  { header: 'Organization', key: 'organization' },
  { header: 'Host', key: 'hostName' },
  { header: 'Facility', key: 'facilityName' },
  { header: 'Status', key: 'status' },
  { header: 'Checked In', key: 'timeIn' },
  { header: 'Checked Out', key: 'timeOut' },
] as const;

function toRows(log: Awaited<ReturnType<typeof visitorLog>>) {
  return log.map((r) => ({
    visitorName: r.visitorName ?? '',
    organization: r.organization ?? '',
    hostName: r.hostName ?? '',
    facilityName: r.facilityName ?? '',
    status: r.status,
    timeIn: r.timeIn ? new Date(r.timeIn).toISOString() : '',
    timeOut: r.timeOut ? new Date(r.timeOut).toISOString() : '',
  }));
}

reportExportRouter.use(asyncHandler(requireReportExport));

reportExportRouter.get(
  '/visitor-log.csv',
  asyncHandler(async (req, res) => {
    const range = reportRangeSchema.parse(req.query);
    const rows = toRows(await visitorLog(range, 5000));
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
    const range = reportRangeSchema.parse(req.query);
    const rows = toRows(await visitorLog(range, 5000));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Visitor Log');
    ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 22 }));
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
