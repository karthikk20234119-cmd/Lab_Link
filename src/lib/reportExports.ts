/**
 * Report Export Utilities
 * Comprehensive export functions for Admin, Staff, Technician, and Student reports
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ReportFilters {
  departmentId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  borrowStatus?: string;
  memberType?: 'student' | 'staff' | 'technician' | 'all';
  searchQuery?: string;
}

export interface BorrowReportRow {
  id: string;
  itemName: string;
  itemCode: string;
  category: string;
  department: string;
  borrowerName: string;
  borrowerEmail: string;
  quantity: number;
  purpose: string;
  requestDate: string;
  startDate: string;
  endDate: string;
  status: string;
  approvedBy: string;
  approvalDate: string;
  pickupLocation: string;
  returnDate: string;
  receivedBy: string;
  itemCondition: string;
  conditionNotes: string;
}

export interface ItemReportRow {
  itemCode: string;
  name: string;
  description: string;
  category: string;
  department: string;
  status: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  location: string;
  brand: string;
  model: string;
  serialNumber: string;
  warrantyUntil: string;
  safetyLevel: string;
  addedBy: string;
  addedDate: string;
}

export interface MemberReportRow {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  college: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  lastLogin: string;
}

export interface DamageReportRow {
  id: string;
  itemName: string;
  itemCode: string;
  damageType: string;
  severity: string;
  description: string;
  status: string;
  reportedBy: string;
  reportedDate: string;
  reviewedBy: string;
  reviewedDate: string;
  resolutionNotes: string;
  maintenanceStatus: string;
  maintenanceCost: number;
}

export interface MaintenanceReportRow {
  id: string;
  itemName: string;
  itemCode: string;
  reason: string;
  status: string;
  assignedTo: string;
  startDate: string;
  estimatedCompletion: string;
  actualCompletion: string;
  cost: number;
  repairNotes: string;
  partsUsed: string;
}

// ============================================================================
// PDF Export Functions
// ============================================================================

const PDF_COLORS = {
  primary: [59, 130, 246] as [number, number, number],
  success: [16, 185, 129] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  purple: [139, 92, 246] as [number, number, number],
  pink: [236, 72, 153] as [number, number, number],
  dark: [30, 41, 59] as [number, number, number],
};

function createPDFHeader(doc: jsPDF, title: string, subtitle: string, filters?: ReportFilters) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const currentDate = format(new Date(), 'MMM dd, yyyy HH:mm');

  // Header background
  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Add gradient effect
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 35, pageWidth, 5, 'F');

  // Title
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 14, 18);

  // Subtitle
  doc.setFontSize(10);
  doc.text(subtitle, 14, 28);

  // Date
  doc.setFontSize(8);
  doc.text(`Generated: ${currentDate}`, pageWidth - 14, 18, { align: 'right' });

  // Filter info if provided
  if (filters) {
    const filterParts: string[] = [];
    if (filters.dateFrom && filters.dateTo) {
      filterParts.push(`Period: ${filters.dateFrom} to ${filters.dateTo}`);
    }
    if (filters.departmentId && filters.departmentId !== 'all') {
      filterParts.push(`Dept: ${filters.departmentId}`);
    }
    if (filters.status && filters.status !== 'all') {
      filterParts.push(`Status: ${filters.status}`);
    }
    if (filterParts.length > 0) {
      doc.text(filterParts.join(' | '), pageWidth - 14, 28, { align: 'right' });
    }
  }

  return 50; // Return Y position after header
}

function addPDFFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount} | LabLink Digital Lab Inventory System | Confidential`,
      14,
      doc.internal.pageSize.height - 10
    );
  }
}

export function generateBorrowHistoryPDF(
  data: BorrowReportRow[],
  filters: ReportFilters,
  reportTitle: string = 'Borrow/Return History Report'
): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const startY = createPDFHeader(doc, 'LabLink ' + reportTitle, 'Comprehensive borrowing and return records', filters);

  // Summary section
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text('Summary', 14, startY);

  const summaryData = [
    ['Total Records', data.length.toString()],
    ['Pending', data.filter(r => r.status === 'pending').length.toString()],
    ['Approved', data.filter(r => r.status === 'approved').length.toString()],
    ['Returned', data.filter(r => r.status === 'returned').length.toString()],
    ['Rejected', data.filter(r => r.status === 'rejected').length.toString()],
  ];

  autoTable(doc, {
    startY: startY + 5,
    head: [['Metric', 'Count']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.primary, textColor: 255 },
    styles: { fontSize: 9 },
    tableWidth: 80,
  });

  // Main data table
  const tableY = (doc as any).lastAutoTable.finalY + 15;
  doc.text('Detailed Records', 14, tableY);

  autoTable(doc, {
    startY: tableY + 5,
    head: [[
      'Item', 'Code', 'Borrower', 'Qty', 'Status', 'Request Date',
      'Start', 'End', 'Approved By', 'Return Date', 'Condition'
    ]],
    body: data.map(row => [
      row.itemName.substring(0, 20),
      row.itemCode,
      row.borrowerName.substring(0, 15),
      row.quantity.toString(),
      row.status.toUpperCase(),
      row.requestDate ? format(new Date(row.requestDate), 'MMM d, yy') : '-',
      row.startDate ? format(new Date(row.startDate), 'MMM d') : '-',
      row.endDate ? format(new Date(row.endDate), 'MMM d') : '-',
      row.approvedBy || '-',
      row.returnDate ? format(new Date(row.returnDate), 'MMM d, yy') : '-',
      row.itemCondition || '-',
    ]),
    theme: 'striped',
    headStyles: { fillColor: PDF_COLORS.success, textColor: 255, fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  addPDFFooter(doc);
  doc.save(`lablink-borrow-history-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function generateItemDetailsPDF(
  data: ItemReportRow[],
  filters: ReportFilters,
  reportTitle: string = 'Item Inventory Report'
): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const startY = createPDFHeader(doc, 'LabLink ' + reportTitle, 'Complete item inventory with details', filters);

  // Summary
  const totalValue = data.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
  
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text('Summary', 14, startY);

  autoTable(doc, {
    startY: startY + 5,
    head: [['Metric', 'Value']],
    body: [
      ['Total Items', data.length.toString()],
      ['Total Value', `Rs.${totalValue.toLocaleString()}`],
      ['Available', data.filter(i => i.status === 'available').length.toString()],
      ['Borrowed', data.filter(i => i.status === 'borrowed').length.toString()],
      ['Under Maintenance', data.filter(i => i.status === 'under_maintenance').length.toString()],
      ['Damaged', data.filter(i => i.status === 'damaged').length.toString()],
    ],
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.purple, textColor: 255 },
    styles: { fontSize: 9 },
    tableWidth: 100,
  });

  // Main table
  const tableY = (doc as any).lastAutoTable.finalY + 15;
  doc.text('Item Details', 14, tableY);

  autoTable(doc, {
    startY: tableY + 5,
    head: [[
      'Code', 'Name', 'Category', 'Dept', 'Status', 'Qty',
      'Price (Rs.)', 'Location', 'Brand', 'Safety'
    ]],
    body: data.map(row => [
      row.itemCode,
      row.name.substring(0, 25),
      row.category || '-',
      row.department || '-',
      row.status.replace(/_/g, ' '),
      row.quantity.toString(),
      row.purchasePrice?.toLocaleString() || '-',
      row.location?.substring(0, 15) || '-',
      row.brand?.substring(0, 12) || '-',
      row.safetyLevel || 'low',
    ]),
    theme: 'striped',
    headStyles: { fillColor: PDF_COLORS.purple, textColor: 255, fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
  });

  addPDFFooter(doc);
  doc.save(`lablink-items-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function generateMembersPDF(
  data: MemberReportRow[],
  filters: ReportFilters,
  reportTitle: string = 'Members Report'
): void {
  const doc = new jsPDF();
  const startY = createPDFHeader(doc, 'LabLink ' + reportTitle, 'User and member information', filters);

  // Summary by role
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text('Summary by Role', 14, startY);

  const roleCounts = {
    admin: data.filter(m => m.role === 'admin').length,
    staff: data.filter(m => m.role === 'staff').length,
    technician: data.filter(m => m.role === 'technician').length,
    student: data.filter(m => m.role === 'student').length,
  };

  autoTable(doc, {
    startY: startY + 5,
    head: [['Role', 'Count', 'Active', 'Verified']],
    body: [
      ['Admin', roleCounts.admin.toString(), data.filter(m => m.role === 'admin' && m.isActive).length.toString(), data.filter(m => m.role === 'admin' && m.isVerified).length.toString()],
      ['Staff', roleCounts.staff.toString(), data.filter(m => m.role === 'staff' && m.isActive).length.toString(), data.filter(m => m.role === 'staff' && m.isVerified).length.toString()],
      ['Technician', roleCounts.technician.toString(), data.filter(m => m.role === 'technician' && m.isActive).length.toString(), data.filter(m => m.role === 'technician' && m.isVerified).length.toString()],
      ['Student', roleCounts.student.toString(), data.filter(m => m.role === 'student' && m.isActive).length.toString(), data.filter(m => m.role === 'student' && m.isVerified).length.toString()],
    ],
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.pink, textColor: 255 },
    styles: { fontSize: 9 },
  });

  // Member list
  const tableY = (doc as any).lastAutoTable.finalY + 15;
  doc.text('Member Details', 14, tableY);

  autoTable(doc, {
    startY: tableY + 5,
    head: [['Name', 'Email', 'Role', 'Department', 'Status', 'Joined']],
    body: data.map(row => [
      row.fullName,
      row.email,
      row.role.charAt(0).toUpperCase() + row.role.slice(1),
      row.department || '-',
      row.isActive ? 'Active' : 'Inactive',
      row.createdAt ? format(new Date(row.createdAt), 'MMM d, yyyy') : '-',
    ]),
    theme: 'striped',
    headStyles: { fillColor: PDF_COLORS.pink, textColor: 255, fontSize: 9 },
    styles: { fontSize: 8 },
  });

  addPDFFooter(doc);
  doc.save(`lablink-members-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function generateDamageMaintenancePDF(
  damageData: DamageReportRow[],
  maintenanceData: MaintenanceReportRow[],
  filters: ReportFilters,
  reportTitle: string = 'Damage & Maintenance Report'
): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const startY = createPDFHeader(doc, 'LabLink ' + reportTitle, 'Damage reports and maintenance records', filters);

  // Damage Reports Section
  doc.setFontSize(14);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text('Damage Reports', 14, startY);

  if (damageData.length > 0) {
    autoTable(doc, {
      startY: startY + 5,
      head: [['Item', 'Code', 'Type', 'Severity', 'Status', 'Reported By', 'Date', 'Resolution']],
      body: damageData.map(row => [
        row.itemName.substring(0, 20),
        row.itemCode,
        row.damageType || '-',
        row.severity,
        row.status,
        row.reportedBy,
        row.reportedDate ? format(new Date(row.reportedDate), 'MMM d, yy') : '-',
        row.resolutionNotes?.substring(0, 30) || '-',
      ]),
      theme: 'striped',
      headStyles: { fillColor: PDF_COLORS.danger, textColor: 255, fontSize: 8 },
      styles: { fontSize: 7 },
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('No damage reports found for the selected filters.', 14, startY + 10);
  }

  // Maintenance Records Section
  const maintY = damageData.length > 0 ? (doc as any).lastAutoTable.finalY + 20 : startY + 25;
  
  // Check if we need a new page
  if (maintY > doc.internal.pageSize.height - 60) {
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text('Maintenance Records', 14, 20);
  } else {
    doc.setFontSize(14);
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text('Maintenance Records', 14, maintY);
  }

  const maintTableY = maintY > doc.internal.pageSize.height - 60 ? 25 : maintY + 5;

  if (maintenanceData.length > 0) {
    autoTable(doc, {
      startY: maintTableY,
      head: [['Item', 'Code', 'Reason', 'Status', 'Assigned To', 'Start', 'Est. Complete', 'Cost (Rs.)']],
      body: maintenanceData.map(row => [
        row.itemName.substring(0, 20),
        row.itemCode,
        row.reason?.substring(0, 25) || '-',
        row.status,
        row.assignedTo || '-',
        row.startDate ? format(new Date(row.startDate), 'MMM d') : '-',
        row.estimatedCompletion ? format(new Date(row.estimatedCompletion), 'MMM d') : '-',
        row.cost?.toLocaleString() || '-',
      ]),
      theme: 'striped',
      headStyles: { fillColor: PDF_COLORS.warning, textColor: 255, fontSize: 8 },
      styles: { fontSize: 7 },
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('No maintenance records found for the selected filters.', 14, maintTableY + 5);
  }

  addPDFFooter(doc);
  doc.save(`lablink-damage-maintenance-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

// Student personal borrow history PDF
export function generateStudentHistoryPDF(
  data: BorrowReportRow[],
  studentName: string
): void {
  const doc = new jsPDF();
  const currentDate = format(new Date(), 'MMM dd, yyyy');

  // Header
  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 35, 'F');

  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('My Borrow History', 14, 18);

  doc.setFontSize(10);
  doc.text(`${studentName} | Generated: ${currentDate}`, 14, 28);

  // Stats
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text('Summary', 14, 50);

  autoTable(doc, {
    startY: 55,
    head: [['Status', 'Count']],
    body: [
      ['Total Requests', data.length.toString()],
      ['Approved', data.filter(r => r.status === 'approved').length.toString()],
      ['Returned', data.filter(r => r.status === 'returned').length.toString()],
      ['Pending', data.filter(r => r.status === 'pending').length.toString()],
      ['Rejected', data.filter(r => r.status === 'rejected').length.toString()],
    ],
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.primary },
    tableWidth: 80,
  });

  // History table
  const tableY = (doc as any).lastAutoTable.finalY + 15;
  doc.text('Borrow History', 14, tableY);

  autoTable(doc, {
    startY: tableY + 5,
    head: [['Item', 'Qty', 'Start Date', 'End Date', 'Status', 'Purpose']],
    body: data.map(row => [
      row.itemName,
      row.quantity.toString(),
      row.startDate ? format(new Date(row.startDate), 'MMM d, yyyy') : '-',
      row.endDate ? format(new Date(row.endDate), 'MMM d, yyyy') : '-',
      row.status.charAt(0).toUpperCase() + row.status.slice(1),
      row.purpose?.substring(0, 30) || '-',
    ]),
    theme: 'striped',
    headStyles: { fillColor: PDF_COLORS.success },
  });

  addPDFFooter(doc);
  doc.save(`my-borrow-history-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

// ============================================================================
// Excel Export Functions
// ============================================================================

export function generateBorrowHistoryExcel(
  data: BorrowReportRow[],
  filters: ReportFilters
): void {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['LabLink Borrow/Return History Report'],
    ['Generated', format(new Date(), 'MMM dd, yyyy HH:mm')],
    [''],
    ['Summary'],
    ['Total Records', data.length],
    ['Pending', data.filter(r => r.status === 'pending').length],
    ['Approved', data.filter(r => r.status === 'approved').length],
    ['Returned', data.filter(r => r.status === 'returned').length],
    ['Rejected', data.filter(r => r.status === 'rejected').length],
  ];

  if (filters.dateFrom && filters.dateTo) {
    summaryData.push(['Period', `${filters.dateFrom} to ${filters.dateTo}`]);
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Detailed data sheet
  const detailData = [
    [
      'Request ID', 'Item Name', 'Item Code', 'Category', 'Department',
      'Borrower Name', 'Borrower Email', 'Quantity', 'Purpose',
      'Request Date', 'Start Date', 'End Date', 'Status',
      'Approved By', 'Approval Date', 'Pickup Location',
      'Return Date', 'Received By', 'Item Condition', 'Condition Notes'
    ],
    ...data.map(row => [
      row.id,
      row.itemName,
      row.itemCode,
      row.category,
      row.department,
      row.borrowerName,
      row.borrowerEmail,
      row.quantity,
      row.purpose,
      row.requestDate,
      row.startDate,
      row.endDate,
      row.status,
      row.approvedBy,
      row.approvalDate,
      row.pickupLocation,
      row.returnDate,
      row.receivedBy,
      row.itemCondition,
      row.conditionNotes,
    ]),
  ];

  const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
  detailSheet['!cols'] = [
    { wch: 36 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 20 }, { wch: 25 }, { wch: 8 }, { wch: 30 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 18 }, { wch: 18 }, { wch: 20 },
    { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Borrow History');

  // Status breakdown sheet
  const statusData = [
    ['Status', 'Count', 'Percentage'],
    ['Pending', data.filter(r => r.status === 'pending').length, data.length > 0 ? ((data.filter(r => r.status === 'pending').length / data.length) * 100).toFixed(1) + '%' : '0%'],
    ['Approved', data.filter(r => r.status === 'approved').length, data.length > 0 ? ((data.filter(r => r.status === 'approved').length / data.length) * 100).toFixed(1) + '%' : '0%'],
    ['Returned', data.filter(r => r.status === 'returned').length, data.length > 0 ? ((data.filter(r => r.status === 'returned').length / data.length) * 100).toFixed(1) + '%' : '0%'],
    ['Rejected', data.filter(r => r.status === 'rejected').length, data.length > 0 ? ((data.filter(r => r.status === 'rejected').length / data.length) * 100).toFixed(1) + '%' : '0%'],
  ];
  const statusSheet = XLSX.utils.aoa_to_sheet(statusData);
  XLSX.utils.book_append_sheet(workbook, statusSheet, 'By Status');

  XLSX.writeFile(workbook, `lablink-borrow-history-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export function generateItemDetailsExcel(
  data: ItemReportRow[],
  filters: ReportFilters
): void {
  const workbook = XLSX.utils.book_new();
  const totalValue = data.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);

  // Summary sheet
  const summaryData = [
    ['LabLink Item Inventory Report'],
    ['Generated', format(new Date(), 'MMM dd, yyyy HH:mm')],
    [''],
    ['Summary'],
    ['Total Items', data.length],
    ['Total Value (Rs.)', totalValue],
    ['Available', data.filter(i => i.status === 'available').length],
    ['Borrowed', data.filter(i => i.status === 'borrowed').length],
    ['Under Maintenance', data.filter(i => i.status === 'under_maintenance').length],
    ['Damaged', data.filter(i => i.status === 'damaged').length],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Detailed items sheet
  const detailData = [
    [
      'Item Code', 'Name', 'Description', 'Category', 'Department',
      'Status', 'Quantity', 'Purchase Price (Rs.)', 'Purchase Date',
      'Storage Location', 'Brand', 'Model', 'Serial Number',
      'Warranty Until', 'Safety Level', 'Added By', 'Added Date'
    ],
    ...data.map(row => [
      row.itemCode,
      row.name,
      row.description,
      row.category,
      row.department,
      row.status,
      row.quantity,
      row.purchasePrice,
      row.purchaseDate,
      row.location,
      row.brand,
      row.model,
      row.serialNumber,
      row.warrantyUntil,
      row.safetyLevel,
      row.addedBy,
      row.addedDate,
    ]),
  ];

  const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
  detailSheet['!cols'] = [
    { wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 },
    { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
    { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'All Items');

  // By category sheet
  const categoryMap = new Map<string, { count: number; value: number }>();
  data.forEach(item => {
    const cat = item.category || 'Uncategorized';
    const existing = categoryMap.get(cat) || { count: 0, value: 0 };
    categoryMap.set(cat, {
      count: existing.count + 1,
      value: existing.value + (item.purchasePrice || 0),
    });
  });

  const categoryData = [
    ['Category', 'Item Count', 'Total Value (Rs.)'],
    ...Array.from(categoryMap.entries()).map(([cat, data]) => [cat, data.count, data.value]),
  ];
  const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
  XLSX.utils.book_append_sheet(workbook, categorySheet, 'By Category');

  XLSX.writeFile(workbook, `lablink-items-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export function generateMembersExcel(
  data: MemberReportRow[],
  filters: ReportFilters
): void {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['LabLink Members Report'],
    ['Generated', format(new Date(), 'MMM dd, yyyy HH:mm')],
    [''],
    ['Summary by Role'],
    ['Role', 'Total', 'Active', 'Verified'],
    ['Admin', data.filter(m => m.role === 'admin').length, data.filter(m => m.role === 'admin' && m.isActive).length, data.filter(m => m.role === 'admin' && m.isVerified).length],
    ['Staff', data.filter(m => m.role === 'staff').length, data.filter(m => m.role === 'staff' && m.isActive).length, data.filter(m => m.role === 'staff' && m.isVerified).length],
    ['Technician', data.filter(m => m.role === 'technician').length, data.filter(m => m.role === 'technician' && m.isActive).length, data.filter(m => m.role === 'technician' && m.isVerified).length],
    ['Student', data.filter(m => m.role === 'student').length, data.filter(m => m.role === 'student' && m.isActive).length, data.filter(m => m.role === 'student' && m.isVerified).length],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // All members sheet
  const memberData = [
    ['ID', 'Full Name', 'Email', 'Phone', 'Role', 'Department', 'College', 'Active', 'Verified', 'Joined', 'Last Login'],
    ...data.map(row => [
      row.id,
      row.fullName,
      row.email,
      row.phone,
      row.role,
      row.department,
      row.college,
      row.isActive ? 'Yes' : 'No',
      row.isVerified ? 'Yes' : 'No',
      row.createdAt,
      row.lastLogin,
    ]),
  ];

  const memberSheet = XLSX.utils.aoa_to_sheet(memberData);
  memberSheet['!cols'] = [
    { wch: 36 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, memberSheet, 'All Members');

  XLSX.writeFile(workbook, `lablink-members-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export function generateDamageMaintenanceExcel(
  damageData: DamageReportRow[],
  maintenanceData: MaintenanceReportRow[],
  filters: ReportFilters
): void {
  const workbook = XLSX.utils.book_new();
  const totalMaintenanceCost = maintenanceData.reduce((sum, m) => sum + (m.cost || 0), 0);

  // Summary sheet
  const summaryData = [
    ['LabLink Damage & Maintenance Report'],
    ['Generated', format(new Date(), 'MMM dd, yyyy HH:mm')],
    [''],
    ['Damage Reports Summary'],
    ['Total Reports', damageData.length],
    ['Pending', damageData.filter(d => d.status === 'pending').length],
    ['Resolved', damageData.filter(d => d.status === 'resolved').length],
    ['In Maintenance', damageData.filter(d => d.status === 'maintenance_scheduled').length],
    [''],
    ['Maintenance Summary'],
    ['Total Records', maintenanceData.length],
    ['Total Cost (Rs.)', totalMaintenanceCost],
    ['Pending', maintenanceData.filter(m => m.status === 'pending').length],
    ['In Progress', maintenanceData.filter(m => m.status === 'in_progress').length],
    ['Completed', maintenanceData.filter(m => m.status === 'completed').length],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Damage reports sheet
  const damageSheetData = [
    ['ID', 'Item Name', 'Item Code', 'Damage Type', 'Severity', 'Description', 'Status', 'Reported By', 'Reported Date', 'Reviewed By', 'Reviewed Date', 'Resolution Notes'],
    ...damageData.map(row => [
      row.id,
      row.itemName,
      row.itemCode,
      row.damageType,
      row.severity,
      row.description,
      row.status,
      row.reportedBy,
      row.reportedDate,
      row.reviewedBy,
      row.reviewedDate,
      row.resolutionNotes,
    ]),
  ];

  const damageSheet = XLSX.utils.aoa_to_sheet(damageSheetData);
  XLSX.utils.book_append_sheet(workbook, damageSheet, 'Damage Reports');

  // Maintenance records sheet
  const maintenanceSheetData = [
    ['ID', 'Item Name', 'Item Code', 'Reason', 'Status', 'Assigned To', 'Start Date', 'Est. Completion', 'Actual Completion', 'Cost (Rs.)', 'Repair Notes', 'Parts Used'],
    ...maintenanceData.map(row => [
      row.id,
      row.itemName,
      row.itemCode,
      row.reason,
      row.status,
      row.assignedTo,
      row.startDate,
      row.estimatedCompletion,
      row.actualCompletion,
      row.cost,
      row.repairNotes,
      row.partsUsed,
    ]),
  ];

  const maintenanceSheet = XLSX.utils.aoa_to_sheet(maintenanceSheetData);
  XLSX.utils.book_append_sheet(workbook, maintenanceSheet, 'Maintenance Records');

  XLSX.writeFile(workbook, `lablink-damage-maintenance-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

// Student personal history Excel
export function generateStudentHistoryExcel(
  data: BorrowReportRow[],
  studentName: string
): void {
  const workbook = XLSX.utils.book_new();

  const sheetData = [
    ['My Borrow History - ' + studentName],
    ['Generated', format(new Date(), 'MMM dd, yyyy HH:mm')],
    [''],
    ['Item Name', 'Item Code', 'Quantity', 'Start Date', 'End Date', 'Status', 'Purpose'],
    ...data.map(row => [
      row.itemName,
      row.itemCode,
      row.quantity,
      row.startDate,
      row.endDate,
      row.status,
      row.purpose,
    ]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(sheetData);
  sheet['!cols'] = [
    { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, 'My History');

  XLSX.writeFile(workbook, `my-borrow-history-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

// ============================================================================
// Technician Export Functions
// ============================================================================

export function generateTechnicianRepairsPDF(
  data: MaintenanceReportRow[],
  technicianName: string
): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const currentDate = format(new Date(), 'MMM dd, yyyy');

  // Header
  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 35, 'F');

  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('My Repair Records', 14, 18);

  doc.setFontSize(10);
  doc.text(`${technicianName} | Generated: ${currentDate}`, 14, 28);

  // Stats
  const completed = data.filter(r => r.status === 'completed').length;
  const inProgress = data.filter(r => r.status === 'in_progress').length;
  const pending = data.filter(r => r.status === 'pending').length;
  const totalCost = data.reduce((sum, r) => sum + (r.cost || 0), 0);

  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text('Summary', 14, 50);

  autoTable(doc, {
    startY: 55,
    head: [['Metric', 'Value']],
    body: [
      ['Total Repairs', data.length.toString()],
      ['Completed', completed.toString()],
      ['In Progress', inProgress.toString()],
      ['Pending', pending.toString()],
      ['Total Cost (Rs.)', totalCost.toLocaleString()],
    ],
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.primary },
    tableWidth: 100,
  });

  // Repairs table
  const tableY = (doc as any).lastAutoTable.finalY + 15;
  doc.text('Repair Details', 14, tableY);

  autoTable(doc, {
    startY: tableY + 5,
    head: [['Item', 'Code', 'Reason', 'Status', 'Start Date', 'Est. Completion', 'Actual', 'Cost (Rs.)', 'Notes']],
    body: data.map(row => [
      row.itemName.substring(0, 18),
      row.itemCode,
      row.reason?.substring(0, 20) || '-',
      row.status.replace(/_/g, ' '),
      row.startDate ? format(new Date(row.startDate), 'MMM d') : '-',
      row.estimatedCompletion ? format(new Date(row.estimatedCompletion), 'MMM d') : '-',
      row.actualCompletion ? format(new Date(row.actualCompletion), 'MMM d') : '-',
      row.cost?.toLocaleString() || '-',
      row.repairNotes?.substring(0, 20) || '-',
    ]),
    theme: 'striped',
    headStyles: { fillColor: PDF_COLORS.warning, textColor: 255, fontSize: 8 },
    styles: { fontSize: 7 },
  });

  addPDFFooter(doc);
  doc.save(`my-repairs-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function generateTechnicianRepairsExcel(
  data: MaintenanceReportRow[],
  technicianName: string
): void {
  const workbook = XLSX.utils.book_new();
  const totalCost = data.reduce((sum, r) => sum + (r.cost || 0), 0);

  // Summary sheet
  const summaryData = [
    ['My Repair Records - ' + technicianName],
    ['Generated', format(new Date(), 'MMM dd, yyyy HH:mm')],
    [''],
    ['Summary'],
    ['Total Repairs', data.length],
    ['Completed', data.filter(r => r.status === 'completed').length],
    ['In Progress', data.filter(r => r.status === 'in_progress').length],
    ['Pending', data.filter(r => r.status === 'pending').length],
    ['Total Cost (Rs.)', totalCost],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Repairs sheet
  const repairsData = [
    ['Item Name', 'Item Code', 'Reason', 'Status', 'Start Date', 'Est. Completion', 'Actual Completion', 'Cost (Rs.)', 'Repair Notes', 'Parts Used'],
    ...data.map(row => [
      row.itemName,
      row.itemCode,
      row.reason,
      row.status,
      row.startDate,
      row.estimatedCompletion,
      row.actualCompletion,
      row.cost,
      row.repairNotes,
      row.partsUsed,
    ]),
  ];

  const repairsSheet = XLSX.utils.aoa_to_sheet(repairsData);
  repairsSheet['!cols'] = [
    { wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 35 }, { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(workbook, repairsSheet, 'My Repairs');

  XLSX.writeFile(workbook, `my-repairs-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

