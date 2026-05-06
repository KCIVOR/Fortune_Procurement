import { format } from 'date-fns';

/**
 * Formats RFQ details into a clean, professional text message for Viber/Messaging.
 */
export function formatRfqForViber(
  rfq: any,
  pr1: any,
  items: any[],
  supplierAssignmentId?: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const deadlineStr = rfq.deadline ? format(new Date(rfq.deadline), 'MMM d, yyyy') : 'N/A';
  
  let text = `📢 *NEW RFQ ISSUED*\n`;
  text += `---------------------------\n`;
  text += `*RFQ:* ${rfq.rfq_number}\n`;
  text += `*Dept:* ${pr1.department_name_snapshot}\n`;
  text += `*Purpose:* ${pr1.purpose}\n`;
  text += `*Deadline:* ${deadlineStr}\n\n`;

  text += `*Items:*\n`;
  items.slice(0, 10).forEach((item, idx) => {
    text += `${idx + 1}. ${item.description} (${item.quantity_requested} ${item.unit_of_measure})\n`;
  });

  if (items.length > 10) {
    text += `...and ${items.length - 10} more items.\n`;
  }

  if (supplierAssignmentId) {
    text += `\n*Submit Quote Here:*\n${appUrl}/supplier/quotations/${supplierAssignmentId}\n`;
  } else {
    text += `\n*Login to submit quote:*\n${appUrl}/login\n`;
  }
  
  text += `---------------------------`;

  return text;
}
