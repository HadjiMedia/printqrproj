import { PrintOrder, OrderFile } from '../types/print';

/**
 * Safely downloads the customer's uploaded print document.
 * Calls direct download endpoint or saves Base64 data URL.
 */
export function downloadOrderFile(order: PrintOrder, targetFileId?: string) {
  try {
    const file: OrderFile | undefined = targetFileId
      ? order.files.find(f => f.id === targetFileId)
      : order.files[0];

    if (!file) return false;

    // Direct endpoint download
    const url = `/api/orders/${order.id}/files/${file.id}?token=${order.trackingToken}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (error) {
    console.error('Failed to download file:', error);
    return false;
  }
}
