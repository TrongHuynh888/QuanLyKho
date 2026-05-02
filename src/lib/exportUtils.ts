import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

type Row = Record<string, string | number | boolean | null | undefined>;

/**
 * Tiện ích: Xuất dữ liệu ra file Excel (.xlsx) với định dạng bảng biểu đẹp.
 * Hỗ trợ in đậm tiêu đề, tô màu nền tĩnh, chia viền ô, format độ rộng cột.
 * @param data Mảng các object, mỗi object tương ứng với một dòng dữ liệu.
 * @param columns Danh sách các cột { key, header, width? }.
 * @param filename Tên file khi tải xuống (bao gồm .xlsx).
 * @param sheetName Tên sheet (mặc định "Data").
 */
export async function downloadExcel(
  data: Row[],
  columns: { key: string; header: string; width?: number }[],
  filename: string,
  sheetName: string = "Data"
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = columns.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width || 20
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  data.forEach((row) => {
    worksheet.addRow(row);
  });

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
      };
      
      if (rowNumber > 1) {
         if (typeof cell.value === 'number') {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
         } else {
            cell.alignment = { vertical: 'middle' };
         }
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);
}

/**
 * Helper: Tạo tên file đính kèm với timestamp thời gian hiện tại.
 * Tiện dụng cho việc xuất báo cáo để tránh trùng tên file.
 * VD: "inventory_report_20260405_1430.csv"
 * @param prefix Tiền tố của tên file
 * @returns {string} Tên file hoàn chỉnh
 */
export function reportFilename(prefix: string): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${prefix}_${ts}.xlsx`;
}

/**
 * Tiện ích: Định dạng số liệu thành chuẩn tiền tệ Việt Nam (VND).
 * Không bao gồm ký hiệu mã tiền tệ, ví dụ phân cách hàng nghìn bằng dấu chấm.
 * @param value Giá trị tiền cần định dạng
 * @returns {string} Chuỗi tiền tệ đã format
 */
export function formatVND(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "0";
  return new Intl.NumberFormat("vi-VN").format(value);
}
