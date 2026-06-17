import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

/** Renders HTML to a PDF and opens the share sheet (WhatsApp, email, etc.). */
export const shareHtmlAsPdf = async (html: string): Promise<void> => {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share invoice',
      UTI: 'com.adobe.pdf',
    });
  }
};

export interface ExportSheet {
  name: string;
  rows: Record<string, string | number>[];
}

/** Builds an .xlsx workbook from one or more sheets and shares it. */
export const exportXlsx = async (fileName: string, sheets: ExportSheet[]): Promise<void> => {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ '': 'No data' }]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const uri = `${FileSystem.cacheDirectory}${fileName}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Export to Excel',
      UTI: 'com.microsoft.excel.xlsx',
    });
  }
};
