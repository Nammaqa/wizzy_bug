import React, { useMemo, useState, useEffect } from "react";
import * as Icons from "lucide-react";
const {
  LayoutDashboard,
  Bug,
  Plus,
  Users,
  User,
  Settings,
  LogOut,
  Search,
  Bell,
  ChevronDown,
  ArrowUpRight,
  Clock3,
  CircleCheck,
  TriangleAlert,
  Filter,
  Download,
  Menu,
  X,
  ChevronRight,
  Paperclip,
  Send,
  CalendarDays,
  BarChart3,
  FolderKanban,
  Activity,
  ShieldCheck,
  Eye,
  EyeOff,
  Moon,
  Sun,
  UserCog,
  Mail,
  ClipboardList,
  RefreshCcw,
  FolderPlus,
  ArrowLeft,
} = Icons;
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { API, apiFetch, setToken } from "../config/api";
import { formatIST, formatISTLong, timeAgoIST, IST_TZ } from "../utils/date";
import {
  STATUS_LABELS,
  STATUS_VALUES,
  PRIORITY_LABELS,
  SEVERITY_TO_PRIORITY,
  SEVERITY_LABELS,
} from "../utils/constants";
import { Avatar, Logo, RoleBadge, Status } from "../components/Ui";
import {
  initialsOf,
  isAssignedToUser,
  priorityLabel,
  statusLabel,
  buildTimeline,
  pdfText,
  severityLabel,
} from "../utils/formatters";
import BugTable from "../components/BugTable";
import Stats from "../components/Stats";

function buildTrendData(bugs = []) {
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    days.push({
      date,
      count: bugs.filter((bug) => {
        const createdAt = new Date(bug.createdAt);
        return createdAt.toDateString() === date.toDateString();
      }).length,
    });
  }
  return days;
}

function buildSeverityCounts(bugs = []) {
  const counts = Object.fromEntries(
    SEVERITY_LABELS.map((severity) => [severity, 0]),
  );
  bugs.forEach((bug) => {
    const severity = severityLabel(bug.severity, bug.priority);
    if (counts[severity] !== undefined) counts[severity] += 1;
  });
  return counts;
}

function Trend({ trendData = [] }) {
  const counts = trendData.map(({ count }) => count);

  const max = Math.max(1, ...counts);
  const points = counts
    .map((c, i) => {
      const x = (i / (counts.length - 1)) * 100;
      const y = 100 - (c / max) * 90;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = `0,100 ${points} 100,100`;

  return (
    <article className="panel chartCard">
      <div className="panelHead">
        <div>
          <h3>Bug Trend</h3>
          <p>New bugs reported over the last 7 days</p>
        </div>
      </div>
      <div className="chart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="yaxis">
          <polyline className="area" points={areaPoints} />
          <polyline className="line" points={points} />
        </svg>
        <div className="months">
          {trendData.map(({ date }, i) => (
            <span key={i}>
              {date.toLocaleDateString("en-IN", {
                timeZone: IST_TZ,
                weekday: "short",
              })}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

// Severity distribution donut, using the same pre-built .donut CSS.

function Distribution({ bugs = [], counts = buildSeverityCounts(bugs) }) {
  const total = bugs.length || 1;
  const colors = {
    "Blocker(System Crash/Data Loss)": "#c94251",
    Critical: "#ff7d87",
    Major: "#f0a456",
    Minor: "#80aaff",
    Cosmetic: "#9b99a4",
  };

  let cumulative = 0;
  const segments = Object.entries(counts).map(([key, count]) => {
    const pct = count / total;
    const start = cumulative;
    cumulative += pct;
    return {
      key,
      count,
      start: start * 360,
      end: cumulative * 360,
      color: colors[key],
    };
  });

  const gradient = segments
    .map((s) => `${s.color} ${s.start}deg ${s.end}deg`)
    .join(", ");

  return (
    <article className="panel chartCard">
      <div className="panelHead">
        <div>
          <h3>Severity Distribution</h3>
          <p>Breakdown of all bugs by severity</p>
        </div>
      </div>
      <div className="donutWrap">
        <div
          className="donut"
          style={{
            background: bugs.length
              ? `conic-gradient(${gradient})`
              : "var(--border)",
          }}
        >
          <div className="donutHole">
            <strong>{bugs.length}</strong>
            <small>Total</small>
          </div>
        </div>
        <ul className="distLegend">
          {Object.entries(counts).map(([key, count]) => (
            <li key={key}>
              <span style={{ background: colors[key] }} />
              {key === "Blocker(System Crash/Data Loss)" ? "Blocker" : key}
              <b>{count}</b>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function Dashboard({ bugs, setSelected, setPage, user }) {
  const [exportFormat, setExportFormat] = useState("pdf");
  const [exportOpen, setExportOpen] = useState(false);
  const trendData = useMemo(() => buildTrendData(bugs), [bugs]);
  const severityCounts = useMemo(() => buildSeverityCounts(bugs), [bugs]);
  const severityRows = Object.entries(severityCounts).map(([severity, count]) => [
    severity === "Blocker(System Crash/Data Loss)" ? "Blocker" : severity,
    count,
  ]);
  const trendRows = trendData.map(({ date, count }) => [
    date.toLocaleDateString("en-IN", {
      timeZone: IST_TZ,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    count,
  ]);

  const reportHeaders = [
    "BUG ID",
    "TITLE",
    "SEVERITY",
    "PRIORITY",
    "STATUS",
    "PROJECT",
    "REPORTER",
    "ASSIGNEE",
    "CREATED (IST)",
  ];

  const reportRows = bugs.map((b) => [
    b.id,
    b.title,
    b.severity,
    priorityLabel(b.priority),
    statusLabel(b.status),
    b.project,
    b.reporter,
    b.assignee,
    formatIST(b.createdAt),
  ]);

  const bugSummary = [
    ["Total Bugs", bugs.length],
    ["In Progress", bugs.filter((b) => b.status === "in_progress").length],
    ["Open Bugs", bugs.filter((b) => b.status === "open").length],
    [
      "Closed",
      bugs.filter((b) => b.status === "closed" || b.status === "resolved")
        .length,
    ],
  ];

  const downloadBlob = (content, type, filename) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const center = pageWidth / 2;
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text("BUG REPORT", center, 16, { align: "center" });
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(pdfText(`Generated ${formatIST(new Date())} IST`), center, 23, {
      align: "center",
    });

    autoTable(doc, {
      head: [bugSummary.map(([label]) => label.toUpperCase())],
      body: [bugSummary.map(([, count]) => String(count))],
      startY: 31,
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [91, 70, 190],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
      },
      bodyStyles: {
        fontStyle: "bold",
        fontSize: 13,
        halign: "center",
        textColor: [35, 35, 45],
        cellPadding: 4,
      },
      alternateRowStyles: { fillColor: [245, 243, 252] },
    });

    autoTable(doc, {
      head: [["SEVERITY DISTRIBUTION", "COUNT"]],
      body: severityRows.map(([severity, count]) => [pdfText(severity), count]),
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [91, 70, 190],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 243, 252] },
    });

    autoTable(doc, {
      head: [["BUG TREND - LAST 7 DAYS", "NEW BUGS"]],
      body: trendRows.map(([date, count]) => [date, count]),
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [91, 70, 190],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 243, 252] },
    });

    const tableRows = reportRows.map((row) => row.map(pdfText));
    autoTable(doc, {
      head: [reportHeaders],
      body: tableRows,
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [91, 70, 190],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7,
        cellPadding: 2,
        halign: "center",
        valign: "middle",
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        overflow: "linebreak",
        valign: "top",
      },
      alternateRowStyles: {
        fillColor: [245, 243, 252],
      },
      columnStyles: {
        0: { cellWidth: 14, halign: "center" },
        1: { cellWidth: 36 },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 20 },
        6: { cellWidth: 18 },
        7: { cellWidth: 18 },
        8: { cellWidth: 20, halign: "center" },
      },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`WizzyBug | Page ${page} of ${pageCount}`, center, 290, {
        align: "center",
      });
    }

    doc.save("wizzybug_bugs_report.pdf");
  };

  const exportToDelimited = (format) => {
    if (format === "excel") {
      const workbook = XLSX.utils.book_new();
      const headerStyle = {
        fill: { fgColor: { rgb: "5B46BE" } },
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "40328C" } },
          bottom: { style: "thin", color: { rgb: "40328C" } },
          left: { style: "thin", color: { rgb: "40328C" } },
          right: { style: "thin", color: { rgb: "40328C" } },
        },
      };
      const dataStyle = (rowIndex) => ({
        fill: { fgColor: { rgb: rowIndex % 2 ? "F5F3FC" : "FFFFFF" } },
        alignment: { vertical: "top", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "D9C9F2" } },
          bottom: { style: "thin", color: { rgb: "D9C9F2" } },
          left: { style: "thin", color: { rgb: "D9C9F2" } },
          right: { style: "thin", color: { rgb: "D9C9F2" } },
        },
      });
      const dashboardRows = [["WIZZYBUG DASHBOARD REPORT"], []];
      const sections = [
        {
          title: "BUG SUMMARY",
          headers: ["Metric", "Count"],
          rows: bugSummary,
        },
        {
          title: "SEVERITY DISTRIBUTION",
          headers: ["Severity", "Count"],
          rows: severityRows,
        },
        {
          title: "BUG TREND - LAST 7 DAYS",
          headers: ["Date", "New Bugs"],
          rows: trendRows,
        },
      ];
      const sectionRanges = sections.map((section) => {
        const titleRow = dashboardRows.length;
        dashboardRows.push([section.title]);
        const headerRow = dashboardRows.length;
        dashboardRows.push(section.headers);
        const dataStartRow = dashboardRows.length;
        dashboardRows.push(...section.rows, []);
        return {
          titleRow,
          headerRow,
          dataStartRow,
          dataEndRow: dataStartRow + section.rows.length,
        };
      });
      const dashboardWorksheet = XLSX.utils.aoa_to_sheet(dashboardRows);
      dashboardWorksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        ...sectionRanges.map(({ titleRow }) => ({
          s: { r: titleRow, c: 0 },
          e: { r: titleRow, c: 1 },
        })),
      ];
      dashboardWorksheet["!cols"] = [{ wch: 34 }, { wch: 18 }];
      dashboardWorksheet["A1"].s = {
        fill: { fgColor: { rgb: "40328C" } },
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 },
      };
      sectionRanges.forEach(({ titleRow, headerRow, dataStartRow, dataEndRow }) => {
        dashboardWorksheet[XLSX.utils.encode_cell({ r: titleRow, c: 0 })].s = {
          fill: { fgColor: { rgb: "40328C" } },
          font: { bold: true, color: { rgb: "FFFFFF" } },
        };
        for (let column = 0; column < 2; column += 1) {
          dashboardWorksheet[XLSX.utils.encode_cell({ r: headerRow, c: column })].s =
            headerStyle;
        }
        for (let row = dataStartRow; row < dataEndRow; row += 1) {
          for (let column = 0; column < 2; column += 1) {
            dashboardWorksheet[XLSX.utils.encode_cell({ r: row, c: column })].s =
              dataStyle(row);
          }
        }
      });
      XLSX.utils.book_append_sheet(workbook, dashboardWorksheet, "Dashboard Summary");

      const worksheet = XLSX.utils.aoa_to_sheet([
        reportHeaders,
        ...reportRows,
      ]);
      reportHeaders.forEach((_, columnIndex) => {
        worksheet[XLSX.utils.encode_cell({ r: 0, c: columnIndex })].s =
          headerStyle;
        for (let rowIndex = 1; rowIndex < reportRows.length + 1; rowIndex += 1) {
          worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })].s =
            dataStyle(rowIndex);
        }
      });
      worksheet["!cols"] = [
        { wch: 14 },
        { wch: 42 },
        { wch: 16 },
        { wch: 16 },
        { wch: 20 },
        { wch: 24 },
        { wch: 24 },
        { wch: 24 },
        { wch: 24 },
      ];
      worksheet["!autofilter"] = {
        ref: `A1:${XLSX.utils.encode_col(reportHeaders.length - 1)}${reportRows.length + 1}`,
      };
      XLSX.utils.book_append_sheet(workbook, worksheet, "Bug Report");
      XLSX.writeFile(workbook, "wizzybug_bugs_report.xlsx", {
        compression: true,
      });
      return;
    }

    const escapeCell = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;
    const content = [
      ["WIZZYBUG DASHBOARD REPORT"],
      [],
      ["BUG SUMMARY"],
      ["METRIC", "COUNT"],
      ...bugSummary,
      [],
      ["SEVERITY DISTRIBUTION"],
      ["SEVERITY", "COUNT"],
      ...severityRows,
      [],
      ["BUG TREND - LAST 7 DAYS"],
      ["DATE", "NEW BUGS"],
      ...trendRows,
      [],
      ["BUG DETAILS"],
      reportHeaders,
      ...reportRows,
    ]
      .map((row) => row.map(escapeCell).join(","))
      .join("\r\n");
    downloadBlob(`\uFEFF${content}`, "text/csv;charset=utf-8", "wizzybug_bugs_report.csv");
  };

  const exportReport = () => {
    if (exportFormat === "pdf") exportToPDF();
    else exportToDelimited(exportFormat);
  };

  const isAdmin = user?.role === "admin";

  return (
    <>
      <div className="welcome">
        <div>
          <h2>Hi, {user?.name || "there"}</h2>
          <p>Here's what's happening with your projects today.</p>
        </div>
        <div className="exportMenu">
          <button
            className="outline"
            onClick={() => setExportOpen((open) => !open)}
            aria-expanded={exportOpen}
            aria-haspopup="menu"
          >
            <Download size={17} />
            Download Report
            <ChevronDown size={16} />
          </button>
          {exportOpen && (
            <div className="exportOptions" role="menu">
              {["pdf", "excel", "csv"].map((format) => (
                <button
                  key={format}
                  role="menuitem"
                  className={exportFormat === format ? "selected" : ""}
                  onClick={() => {
                    setExportFormat(format);
                    setExportOpen(false);
                    if (format === "pdf") exportToPDF();
                    else exportToDelimited(format);
                  }}
                >
                  {format === "pdf"
                    ? "PDF"
                    : format === "excel"
                      ? "Excel"
                      : "CSV"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <Stats bugs={bugs} admin={isAdmin} user={user} />
      <div className="analytics">
        <Trend trendData={trendData} />
        <Distribution bugs={bugs} counts={severityCounts} />
      </div>
      <article className="panel recent">
        <div className="panelHead">
          <div>
            <h3>Recent Bugs</h3>
            <p>Latest issues reported across all projects</p>
          </div>
          <button className="link" onClick={() => setPage("bugs")}>
            View all Bugs <ChevronRight size={16} />
          </button>
        </div>
        <BugTable bugs={bugs.slice(0, 5)} setSelected={setSelected} compact />
      </article>
    </>
  );
}

export default Dashboard;
